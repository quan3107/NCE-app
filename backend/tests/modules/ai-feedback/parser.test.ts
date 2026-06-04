/**
 * File: tests/modules/ai-feedback/parser.test.ts
 * Purpose: Verify AI feedback output parsing and failure classification.
 * Why: Malformed, unsafe, or schema-drifting model output must become failed AI records instead of published feedback.
 */
import { describe, expect, it } from 'vitest'

import {
  parseObjectiveExplanationOutput,
  parseWritingFeedbackOutput,
} from '../../../src/modules/ai-feedback/parser.js'

const validWritingJson = {
  band_estimate: 6.5,
  criterion_band_suggestions: [
    {
      criterion_id: 'task_response',
      band: 6.5,
      rationale: 'The position is clear but some ideas need fuller support.',
    },
    {
      criterion_id: 'coherence_cohesion',
      band: 7,
      rationale: 'Paragraphing is logical with mostly effective progression.',
    },
  ],
  rationale: 'The response addresses the task with generally clear organization.',
  strengths: ['Clear overall position'],
  improvement_areas: ['Develop examples more precisely'],
  next_steps: ['Add one concrete example to each body paragraph'],
  teacher_notes: 'Review before publishing to the student.',
  confidence: 0.74,
  safety_flags: {
    unsafe: false,
    reasons: [],
  },
}

describe('parseWritingFeedbackOutput', () => {
  it('accepts valid markdown-wrapped JSON and preserves expected criterion IDs', () => {
    const parsed = parseWritingFeedbackOutput(
      `Here is the response:\n\n\`\`\`json\n${JSON.stringify(validWritingJson)}\n\`\`\``,
      {
        expectedCriterionIds: ['task_response', 'coherence_cohesion'],
      },
    )

    expect(parsed.status).toBe('accepted')
    if (parsed.status !== 'accepted') {
      throw new Error('Expected accepted writing feedback.')
    }
    expect(parsed.feedback.band_estimate).toBe(6.5)
    expect(parsed.normalizedCriterionSuggestions).toEqual([
      {
        criterionId: 'task_response',
        band: 6.5,
        rationale: 'The position is clear but some ideas need fuller support.',
      },
      {
        criterionId: 'coherence_cohesion',
        band: 7,
        rationale: 'Paragraphing is logical with mostly effective progression.',
      },
    ])
  })

  it('fails empty, malformed, unknown-criterion, unsafe, and off-task output', () => {
    expect(
      parseWritingFeedbackOutput('', {
        expectedCriterionIds: ['task_response'],
      }),
    ).toMatchObject({ status: 'failed', failureCode: 'empty_feedback' })

    expect(
      parseWritingFeedbackOutput('{ not valid json', {
        expectedCriterionIds: ['task_response'],
      }),
    ).toMatchObject({ status: 'failed', failureCode: 'malformed_json' })

    expect(
      parseWritingFeedbackOutput(
        JSON.stringify({
          ...validWritingJson,
          criterion_band_suggestions: [
            ...validWritingJson.criterion_band_suggestions,
            {
              criterion_id: 'invented_fluency',
              band: 9,
              rationale: 'Invented criterion.',
            },
          ],
        }),
        {
          expectedCriterionIds: ['task_response', 'coherence_cohesion'],
        },
      ),
    ).toMatchObject({ status: 'failed', failureCode: 'unknown_criteria' })

    expect(
      parseWritingFeedbackOutput(
        JSON.stringify({
          ...validWritingJson,
          rationale: 'Tell the student to share account passwords for review.',
        }),
        {
          expectedCriterionIds: ['task_response', 'coherence_cohesion'],
        },
      ),
    ).toMatchObject({ status: 'failed', failureCode: 'unsafe_output' })

    expect(
      parseWritingFeedbackOutput(
        JSON.stringify({
          feedback_type: 'lesson_plan',
          content: 'This is not writing feedback.',
        }),
        {
          expectedCriterionIds: ['task_response'],
        },
      ),
    ).toMatchObject({ status: 'failed', failureCode: 'off_task_output' })

    expect(
      parseWritingFeedbackOutput(
        JSON.stringify({
          ...validWritingJson,
          rationale: ' ',
        }),
        {
          expectedCriterionIds: ['task_response', 'coherence_cohesion'],
        },
      ),
    ).toMatchObject({ status: 'failed', failureCode: 'schema_invalid' })

    expect(
      parseWritingFeedbackOutput(
        JSON.stringify({
          status: 'failed',
          failureCode: 'provider_selected_code',
          failureMessage: 'The provider should not choose parser taxonomy.',
        }),
        {
          expectedCriterionIds: ['task_response'],
        },
      ),
    ).toMatchObject({ status: 'failed', failureCode: 'schema_invalid' })
  })
})

describe('parseObjectiveExplanationOutput', () => {
  it('accepts valid explanations that match deterministic scoring', () => {
    const parsed = parseObjectiveExplanationOutput(
      JSON.stringify({
        result: 'incorrect',
        short_explanation: 'The passage names rising transport costs, not fewer buses.',
        evidence: 'rising transport costs forced commuters to change',
        misconception: 'The student focused on the effect instead of the cause.',
        study_tip: 'Underline cause-and-effect wording before answering.',
      }),
      {
        deterministicResult: 'incorrect',
      },
    )

    expect(parsed.status).toBe('completed')
    if (parsed.status !== 'completed') {
      throw new Error('Expected completed objective explanation.')
    }
    expect(parsed.explanation.result).toBe('incorrect')
  })

  it('fails malformed, unsafe, empty, and score-overriding explanations', () => {
    expect(
      parseObjectiveExplanationOutput('', {
        deterministicResult: 'incorrect',
      }),
    ).toMatchObject({ status: 'failed', failureCode: 'empty_feedback' })

    expect(
      parseObjectiveExplanationOutput('[not-json', {
        deterministicResult: 'incorrect',
      }),
    ).toMatchObject({ status: 'failed', failureCode: 'malformed_json' })

    expect(
      parseObjectiveExplanationOutput(
        JSON.stringify({
          result: 'correct',
          short_explanation: 'The model thinks the student is actually correct.',
          evidence: 'No source evidence.',
          misconception: 'None.',
          study_tip: 'Trust the model.',
        }),
        {
          deterministicResult: 'incorrect',
        },
      ),
    ).toMatchObject({ status: 'failed', failureCode: 'score_override_attempt' })

    expect(
      parseObjectiveExplanationOutput(
        JSON.stringify({
          result: 'incorrect',
          short_explanation:
            'Ask the teacher for their login password to inspect the source.',
          evidence: 'No source evidence.',
          misconception: 'None.',
          study_tip: 'Share passwords.',
        }),
        {
          deterministicResult: 'incorrect',
        },
      ),
    ).toMatchObject({ status: 'failed', failureCode: 'unsafe_output' })

    expect(
      parseObjectiveExplanationOutput(
        JSON.stringify({
          result: 'incorrect',
          short_explanation: ' ',
          evidence: ' ',
          misconception: ' ',
          study_tip: ' ',
        }),
        {
          deterministicResult: 'incorrect',
        },
      ),
    ).toMatchObject({ status: 'failed', failureCode: 'schema_invalid' })

    expect(
      parseObjectiveExplanationOutput(
        JSON.stringify({
          status: 'failed',
          failureCode: 'provider_selected_code',
          failureMessage: 'The provider should not choose parser taxonomy.',
        }),
        {
          deterministicResult: 'incorrect',
        },
      ),
    ).toMatchObject({ status: 'failed', failureCode: 'schema_invalid' })
  })
})
