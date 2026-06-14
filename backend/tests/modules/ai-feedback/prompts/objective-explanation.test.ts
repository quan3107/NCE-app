/**
 * File: tests/modules/ai-feedback/prompts/objective-explanation.test.ts
 * Purpose: Verify deterministic reading/listening explanation prompt assembly.
 * Why: Objective explanations must explain server scoring without overriding the answer key or pretending to inspect unavailable media.
 */
import { describe, expect, it } from 'vitest'

import { buildObjectiveExplanationPrompt } from '../../../../src/modules/ai-feedback/prompts/objective-explanation.js'

describe('buildObjectiveExplanationPrompt', () => {
  it('builds reading explanation prompts with answer-key boundaries and evidence context', () => {
    const prompt = buildObjectiveExplanationPrompt({
      assignment: {
        title: 'Reading Practice 1',
        type: 'reading',
        config: {
          version: 1,
          aiPolicy: {
            writingFeedbackMode: 'off',
            objectiveExplanations: 'on_demand_student_visible',
            providerTier: 'low_cost',
          },
        },
      },
      question: {
        id: 'q-1',
        text: 'What is the main reason the writer gives?',
        acceptedAnswer: 'Rising transport costs',
      },
      studentAnswer: 'Fewer buses',
      deterministicResult: 'incorrect',
      sourceContext: {
        kind: 'reading_passage',
        text: 'The writer says rising transport costs forced commuters to change.',
      },
    })

    const messages = JSON.stringify(prompt.request.messages)

    expect(prompt.promptVersion).toBe('objective-explanation-v1')
    expect(prompt.request).toMatchObject({
      taskType: 'objective_explanation',
      expectJson: true,
      temperature: 0,
      assignmentPolicy: {
        highStakes: false,
        preferredRoute: 'low_cost',
      },
    })
    expect(messages).toContain('never override the answer key')
    expect(messages).toContain('exact quote')
    expect(messages).toContain('Rising transport costs')
    expect(messages).toContain('rising transport costs forced commuters')
  })

  it('distinguishes listening transcript context from audio-file-only context', () => {
    const withTranscript = buildObjectiveExplanationPrompt({
      assignment: {
        title: 'Listening Section 2',
        type: 'listening',
        config: {
          version: 1,
          aiPolicy: {
            writingFeedbackMode: 'off',
            objectiveExplanations: 'on_demand_student_visible',
            providerTier: 'auto',
          },
        },
      },
      question: {
        id: 'q-2',
        text: 'Where should visitors meet?',
        acceptedAnswer: 'Main gate',
      },
      studentAnswer: 'Ticket office',
      deterministicResult: 'incorrect',
      sourceContext: {
        kind: 'listening_transcript',
        text: 'Guide: Please meet at the main gate after lunch.',
      },
    })
    const audioOnly = buildObjectiveExplanationPrompt({
      assignment: {
        title: 'Listening Section 2',
        type: 'listening',
        config: {
          version: 1,
          aiPolicy: {
            writingFeedbackMode: 'off',
            objectiveExplanations: 'on_demand_student_visible',
            providerTier: 'auto',
          },
        },
      },
      question: {
        id: 'q-2',
        text: 'Where should visitors meet?',
        acceptedAnswer: 'Main gate',
      },
      studentAnswer: 'Ticket office',
      deterministicResult: 'incorrect',
      sourceContext: {
        kind: 'listening_audio_file',
        audioFileId: '0f15fd9a-0f42-4b3d-9bd0-9d0a261b1c0f',
      },
    })

    expect(JSON.stringify(withTranscript.request.messages)).toContain(
      'Please meet at the main gate',
    )
    expect(JSON.stringify(audioOnly.request.messages)).toContain(
      'must not pretend to inspect audio',
    )
    expect(JSON.stringify(audioOnly.request.messages)).toContain(
      '0f15fd9a-0f42-4b3d-9bd0-9d0a261b1c0f',
    )
  })

  it('keeps an explicit student answer field for missing responses', () => {
    const prompt = buildObjectiveExplanationPrompt({
      assignment: {
        title: 'Reading Practice 1',
        type: 'reading',
        config: {
          version: 1,
          aiPolicy: {
            writingFeedbackMode: 'off',
            objectiveExplanations: 'on_demand_student_visible',
            providerTier: 'auto',
          },
        },
      },
      question: {
        id: 'q-3',
        text: 'Which reason is given?',
        acceptedAnswer: 'High demand',
      },
      studentAnswer: undefined,
      deterministicResult: 'incorrect',
      sourceContext: {
        kind: 'reading_passage',
        text: 'The passage states that high demand caused the delay.',
      },
    })
    const userPayload = JSON.parse(prompt.request.messages[1].content) as {
      student_answer?: unknown
    }

    expect(userPayload).toHaveProperty('student_answer', null)
  })
})
