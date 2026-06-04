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
  criteria: [
    {
      id: 'task_achievement',
      task: 'task1',
      label: 'Task Achievement',
      description: 'Assesses task coverage and relevant overview.',
    },
    {
      id: 'task_response',
      task: 'task2',
      label: 'Task Response',
      description: 'Assesses position, ideas, and development.',
    },
    {
      id: 'coherence_cohesion',
      task: 'both',
      label: 'Coherence and Cohesion',
      description: 'Assesses logical organization and linking.',
    },
  ],
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
    expect(serializedMessages).toContain('criterion_id')
    expect(serializedMessages).toContain('JSON-only')
    expect(serializedMessages).toContain('teacher-final grade')
    expect(serializedMessages).not.toContain('Private Student')
    expect(serializedMessages).not.toContain('private.student@example.com')
  })
})
