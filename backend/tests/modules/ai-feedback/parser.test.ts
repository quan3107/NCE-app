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

  it('accepts canonical Task 2 criteria and returns the criteria version', () => {
    const parsed = parseWritingFeedbackOutput(
      JSON.stringify({
        ...validWritingJson,
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
          {
            criterion_id: 'lexical_resource',
            band: 7,
            rationale: 'Vocabulary is flexible enough for the topic.',
          },
          {
            criterion_id: 'grammatical_range_accuracy',
            band: 6.5,
            rationale: 'Sentence forms are varied with some recurring errors.',
          },
        ],
      }),
      {
        writingTask: 'task2',
      },
    )

    expect(parsed.status).toBe('accepted')
    if (parsed.status !== 'accepted') {
      throw new Error('Expected accepted writing feedback.')
    }
    expect(parsed.criteriaVersion).toBe('ielts-writing-criteria-v1')
    expect(parsed.normalizedCriterionSuggestions.map((item) => item.criterionId)).toEqual(
      [
        'task_response',
        'coherence_cohesion',
        'lexical_resource',
        'grammatical_range_accuracy',
      ],
    )
  })

  it('accepts canonical combined criteria and returns the criteria version', () => {
    const parsed = parseWritingFeedbackOutput(
      JSON.stringify({
        ...validWritingJson,
        criterion_band_suggestions: [
          {
            criterion_id: 'task_achievement',
            band: 6,
            rationale: 'Task 1 has an overview but limited detail.',
          },
          {
            criterion_id: 'task_response',
            band: 7,
            rationale: 'Task 2 position is clear and supported.',
          },
          {
            criterion_id: 'coherence_cohesion',
            band: 7,
            rationale: 'Ideas progress clearly across both tasks.',
          },
          {
            criterion_id: 'lexical_resource',
            band: 7,
            rationale: 'Vocabulary is flexible across both responses.',
          },
          {
            criterion_id: 'grammatical_range_accuracy',
            band: 6.5,
            rationale: 'Grammar is varied but some errors recur.',
          },
        ],
      }),
      {
        writingScope: 'combined',
      },
    )

    expect(parsed.status).toBe('accepted')
    if (parsed.status !== 'accepted') {
      throw new Error('Expected accepted writing feedback.')
    }
    expect(parsed.criteriaVersion).toBe('ielts-writing-criteria-v1')
    expect(parsed.normalizedCriterionSuggestions.map((item) => item.criterionId)).toEqual(
      [
        'task_achievement',
        'task_response',
        'coherence_cohesion',
        'lexical_resource',
        'grammatical_range_accuracy',
      ],
    )
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

  it('fails duplicate, wrong-task, missing, and invalid-band criteria', () => {
    expect(
      parseWritingFeedbackOutput(
        JSON.stringify({
          ...validWritingJson,
          criterion_band_suggestions: [
            {
              criterion_id: 'task_response',
              band: 6.5,
              rationale: 'Clear position.',
            },
            {
              criterion_id: 'task_response',
              band: 7,
              rationale: 'Duplicate criterion.',
            },
            {
              criterion_id: 'coherence_cohesion',
              band: 7,
              rationale: 'Mostly clear progression.',
            },
          ],
        }),
        {
          writingTask: 'task2',
        },
      ),
    ).toMatchObject({ status: 'failed', failureCode: 'duplicate_criteria' })

    expect(
      parseWritingFeedbackOutput(
        JSON.stringify({
          ...validWritingJson,
          criterion_band_suggestions: [
            {
              criterion_id: 'task_achievement',
              band: 6.5,
              rationale: 'Wrong task-specific criterion.',
            },
            {
              criterion_id: 'coherence_cohesion',
              band: 7,
              rationale: 'Mostly clear progression.',
            },
            {
              criterion_id: 'lexical_resource',
              band: 7,
              rationale: 'Useful vocabulary range.',
            },
            {
              criterion_id: 'grammatical_range_accuracy',
              band: 7,
              rationale: 'Mostly accurate grammar.',
            },
          ],
        }),
        {
          writingTask: 'task2',
        },
      ),
    ).toMatchObject({ status: 'failed', failureCode: 'wrong_task_criteria' })

    expect(
      parseWritingFeedbackOutput(
        JSON.stringify({
          ...validWritingJson,
          criterion_band_suggestions: [
            {
              criterion_id: 'task_response',
              band: 6.25,
              rationale: 'Invalid half-band value.',
            },
            {
              criterion_id: 'coherence_cohesion',
              band: 7,
              rationale: 'Mostly clear progression.',
            },
            {
              criterion_id: 'lexical_resource',
              band: 7,
              rationale: 'Useful vocabulary range.',
            },
            {
              criterion_id: 'grammatical_range_accuracy',
              band: 7,
              rationale: 'Mostly accurate grammar.',
            },
          ],
        }),
        {
          writingTask: 'task2',
        },
      ),
    ).toMatchObject({ status: 'failed', failureCode: 'invalid_criteria_band' })

    expect(
      parseWritingFeedbackOutput(
        JSON.stringify({
          ...validWritingJson,
          criterion_band_suggestions: [
            {
              criterion_id: 'task_response',
              band: 6.5,
              rationale: 'Clear position.',
            },
            {
              criterion_id: 'coherence_cohesion',
              band: 7,
              rationale: 'Mostly clear progression.',
            },
          ],
        }),
        {
          writingTask: 'task2',
        },
      ),
    ).toMatchObject({ status: 'failed', failureCode: 'missing_criteria' })

    expect(
      parseWritingFeedbackOutput(
        JSON.stringify({
          ...validWritingJson,
          criterion_band_suggestions: [
            {
              criterion_id: 'task_achievement',
              band: 6.25,
              rationale: 'Invalid half-band in combined output.',
            },
            {
              criterion_id: 'task_response',
              band: 7,
              rationale: 'Ok.',
            },
            {
              criterion_id: 'coherence_cohesion',
              band: 7,
              rationale: 'Ok.',
            },
            {
              criterion_id: 'lexical_resource',
              band: 7,
              rationale: 'Ok.',
            },
            {
              criterion_id: 'grammatical_range_accuracy',
              band: 7,
              rationale: 'Ok.',
            },
          ],
        }),
        {
          writingScope: 'combined',
        },
      ),
    ).toMatchObject({ status: 'failed', failureCode: 'invalid_criteria_band' })
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
