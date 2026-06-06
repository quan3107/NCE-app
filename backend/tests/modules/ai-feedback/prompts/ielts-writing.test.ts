/**
 * File: tests/modules/ai-feedback/prompts/ielts-writing.test.ts
 * Purpose: Verify deterministic IELTS writing feedback prompt assembly.
 * Why: Provider adapters should receive stable, student-safe instructions instead of building grading prompts.
 */
import { describe, expect, it } from 'vitest'

import { buildIeltsWritingFeedbackPrompt } from '../../../../src/modules/ai-feedback/prompts/ielts-writing.js'

const promptInput = {
  assignment: {
    title: 'Academic Writing Set A',
    type: 'writing',
    config: {
      version: 1,
      instructions: 'Focus on concise, actionable feedback.',
      aiPolicy: {
        writingFeedbackMode: 'teacher_reviewed',
        objectiveExplanations: 'off',
        providerTier: 'premium',
      },
    },
  },
  tasks: {
    task1: {
      prompt: 'Summarise the chart showing commuter trends.',
      visualType: 'line_graph',
    },
    task2: {
      prompt: 'Discuss both views and give your own opinion.',
    },
  },
  submission: {
    task1: {
      text: 'The line graph compares commuter choices over time.',
    },
    task2: {
      text: 'Some people prefer public transport because it is cheaper.',
    },
    studentName: 'Private Student',
    studentEmail: 'private.student@example.com',
  },
  teacherConstraints: [
    'Do not assign a final teacher grade.',
    'Flag missing visual evidence instead of inventing chart details.',
  ],
}

describe('buildIeltsWritingFeedbackPrompt', () => {
  it('builds a deterministic versioned provider request', () => {
    const first = buildIeltsWritingFeedbackPrompt(promptInput)
    const second = buildIeltsWritingFeedbackPrompt(promptInput)

    expect(first).toEqual(second)
    expect(first.promptVersion).toBe('ielts-writing-feedback-v1')
    expect(first.request).toMatchObject({
      taskType: 'writing_feedback',
      expectJson: true,
      temperature: 0,
      assignmentPolicy: {
        highStakes: false,
        preferredRoute: 'premium',
      },
    })
    expect(first.request.messages).toHaveLength(2)
  })

  it('uses criterion IDs, output contract guardrails, and no submission PII', () => {
    const prompt = buildIeltsWritingFeedbackPrompt(promptInput)
    const serializedMessages = JSON.stringify(prompt.request.messages)

    expect(serializedMessages).toContain('task_achievement')
    expect(serializedMessages).toContain('task_response')
    expect(serializedMessages).toContain('ielts-writing-criteria-v1')
    expect(serializedMessages).toContain('criteria_guardrails')
    expect(serializedMessages).toContain('criterion_id')
    expect(prompt.request.messages[0].content).toContain(
      'Use only these criterion_id values',
    )
    expect(prompt.request.messages[0].content).toContain('Do not invent descriptors')
    expect(serializedMessages).toContain('JSON-only')
    expect(serializedMessages).toContain('teacher-final grade')
    expect(serializedMessages).not.toContain('Private Student')
    expect(serializedMessages).not.toContain('private.student@example.com')

    const userMessage = prompt.request.messages[1]
    expect(userMessage.role).toBe('user')
    const payload = JSON.parse(userMessage.content)
    expect(payload.criteria_pack.criteria).toContainEqual(
      expect.objectContaining({
        criterion_id: 'task_response',
        weight: 0.25,
      }),
    )
  })

  it('includes visual Task 1 image context and supplemental teacher summary', () => {
    const prompt = buildIeltsWritingFeedbackPrompt({
      ...promptInput,
      tasks: {
        ...promptInput.tasks,
        task1: {
          ...promptInput.tasks.task1,
          imageContext: {
            status: 'image_attached',
            teacherSummary: 'The line graph rises sharply after 2024.',
            image: {
              type: 'image',
              imageUrl: 'https://storage.mock/nce/task1-chart.png',
              mimeType: 'image/png',
              detail: 'high',
            },
          },
        },
      },
    })

    expect(prompt.imageContextStatus).toBe('image_attached')
    expect(prompt.request.requiresImageInput).toBe(true)
    expect(prompt.request.messages[1].content).toEqual([
      expect.objectContaining({ type: 'text' }),
      {
        type: 'image',
        imageUrl: 'https://storage.mock/nce/task1-chart.png',
        mimeType: 'image/png',
        detail: 'high',
      },
    ])

    const textPart = prompt.request.messages[1].content[0]
    if (typeof textPart !== 'object' || textPart.type !== 'text') {
      throw new Error('Expected first prompt content part to be text')
    }
    const payload = JSON.parse(textPart.text)
    expect(payload.tasks.task1.image_context).toEqual({
      status: 'image_attached',
      teacher_summary: 'The line graph rises sharply after 2024.',
    })
  })

  it('emits a harness signal when required visual Task 1 image context is unavailable', () => {
    const prompt = buildIeltsWritingFeedbackPrompt({
      ...promptInput,
      tasks: {
        ...promptInput.tasks,
        task1: {
          ...promptInput.tasks.task1,
          imageContext: {
            status: 'image_unavailable',
            reason: 'The attached chart is not an allowed image format.',
          },
        },
      },
    })

    expect(prompt.imageContextStatus).toBe('image_unavailable')
    expect(prompt.imageContextFailure).toEqual({
      failureCode: 'image_context_unavailable',
      failureMessage: 'The attached chart is not an allowed image format.',
    })
    expect(prompt.request.requiresImageInput).toBe(false)
    expect(JSON.stringify(prompt.request.messages)).toContain(
      'image_context_unavailable',
    )
  })
})
