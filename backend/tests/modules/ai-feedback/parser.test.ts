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

  it('accepts source-grounded quoted evidence with normalized casing', () => {
    const parsed = parseObjectiveExplanationOutput(
      JSON.stringify({
        result: 'incorrect',
        short_explanation: 'The answer misses that fare increases caused the route change.',
        evidence: 'RISING fares made commuters switch routes',
        misconception: 'The student named an effect rather than the stated cause.',
        study_tip: 'Compare the question cause with the passage cause before answering.',
      }),
      {
        deterministicResult: 'incorrect',
        sourceContextText:
          'Rising fares made commuters switch routes after the timetable changed.',
      },
    )

    expect(parsed.status).toBe('completed')
  })

  it('accepts source-grounded evidence with ellipsis-delimited excerpt gaps', () => {
    const parsed = parseObjectiveExplanationOutput(
      JSON.stringify({
        result: 'incorrect',
        short_explanation: 'The answer misses that transport costs caused the change.',
        evidence: 'rising transport costs ... route changes',
        misconception: 'The student named the effect rather than the stated cause.',
        study_tip: 'Use ellipses only when the omitted words are in the same source sentence.',
      }),
      {
        deterministicResult: 'incorrect',
        sourceContextText:
          'The passage states that rising transport costs caused route changes after the timetable shifted.',
      },
    )

    expect(parsed.status).toBe('completed')
  })

  it('accepts ellipsis evidence when omitted words only end in nt', () => {
    const parsed = parseObjectiveExplanationOutput(
      JSON.stringify({
        result: 'incorrect',
        short_explanation: 'The answer misses that the mayor discussed taxes.',
        evidence: 'mayor made ... tax',
        misconception: 'The student missed the announcement topic.',
        study_tip: 'Use ellipses only for omitted source words that do not change meaning.',
      }),
      {
        deterministicResult: 'incorrect',
        sourceContextText: 'The mayor made an important announcement about tax.',
      },
    )

    expect(parsed.status).toBe('completed')
  })

  it('rejects objective evidence that is unrelated to the source context', () => {
    const parsed = parseObjectiveExplanationOutput(
      JSON.stringify({
        result: 'incorrect',
        short_explanation: 'The answer misses the stated cause.',
        evidence: 'a mayor announced a new cycling tax',
        misconception: 'The student named an unsupported cause.',
        study_tip: 'Check the passage before selecting a cause.',
      }),
      {
        deterministicResult: 'incorrect',
        sourceContextText:
          'The passage states that rising transport costs caused route changes.',
      },
    )

    expect(parsed).toMatchObject({
      status: 'failed',
      failureCode: 'unsupported_evidence',
    })
  })

  it('rejects source-context evidence outside the allowed candidate list', () => {
    const parsed = parseObjectiveExplanationOutput(
      JSON.stringify({
        result: 'incorrect',
        short_explanation:
          'The answer discusses the mayor, but the selected question is about fares.',
        evidence: 'The mayor announced bike lanes.',
        misconception: 'The student used evidence from a different question.',
        study_tip: 'Use only the evidence attached to the selected question.',
      }),
      {
        deterministicResult: 'incorrect',
        sourceContextText:
          'Rising fares made commuters switch routes. The mayor announced bike lanes.',
        sourceEvidenceCandidates: [
          {
            id: 'q1-evidence-1',
            quote: 'Rising fares made commuters switch routes.',
          },
        ],
      },
    )

    expect(parsed).toMatchObject({
      status: 'failed',
      failureCode: 'unsupported_evidence',
    })
  })

  it('rejects partially hallucinated objective evidence', () => {
    const parsed = parseObjectiveExplanationOutput(
      JSON.stringify({
        result: 'incorrect',
        short_explanation: 'The answer adds a cause that is not in the source.',
        evidence:
          'rising transport costs caused route changes after the mayor announced a new tax',
        misconception: 'The student mixed source evidence with an unsupported detail.',
        study_tip: 'Keep the explanation limited to the provided source.',
      }),
      {
        deterministicResult: 'incorrect',
        sourceContextText:
          'The passage states that rising transport costs caused route changes.',
      },
    )

    expect(parsed).toMatchObject({
      status: 'failed',
      failureCode: 'unsupported_evidence',
    })
  })

  it('rejects evidence that only matches inside a larger source word', () => {
    const parsed = parseObjectiveExplanationOutput(
      JSON.stringify({
        result: 'incorrect',
        short_explanation: 'The source does not mention buses.',
        evidence: 'bus',
        misconception: 'The student inferred a transport type that is not present.',
        study_tip: 'Use only words or ideas supported by the source sentence.',
      }),
      {
        deterministicResult: 'incorrect',
        sourceContextText: 'The business district changed after rising rents.',
      },
    )

    expect(parsed).toMatchObject({
      status: 'failed',
      failureCode: 'unsupported_evidence',
    })
  })

  it('rejects evidence assembled from separate source sentences', () => {
    const parsed = parseObjectiveExplanationOutput(
      JSON.stringify({
        result: 'incorrect',
        short_explanation: 'The evidence joins details from different sentences.',
        evidence: 'the mayor announced rising costs',
        misconception: 'The student combined unrelated details into one claim.',
        study_tip: 'Check that one source sentence supports the whole evidence claim.',
      }),
      {
        deterministicResult: 'incorrect',
        sourceContextText:
          'Rising costs caused route changes. The mayor announced bike lanes.',
      },
    )

    expect(parsed).toMatchObject({
      status: 'failed',
      failureCode: 'unsupported_evidence',
    })
  })

  it('rejects evidence that omits source negation', () => {
    const parsed = parseObjectiveExplanationOutput(
      JSON.stringify({
        result: 'incorrect',
        short_explanation: 'The source says the mayor announced a tax.',
        evidence: 'mayor announced tax',
        misconception: 'The student missed the negation in the source sentence.',
        study_tip: 'Check whether the source denies the evidence claim.',
      }),
      {
        deterministicResult: 'incorrect',
        sourceContextText: 'The mayor announced no tax.',
      },
    )

    expect(parsed).toMatchObject({
      status: 'failed',
      failureCode: 'unsupported_evidence',
    })
  })

  it('rejects ellipsis evidence that hides source negation', () => {
    const parsed = parseObjectiveExplanationOutput(
      JSON.stringify({
        result: 'incorrect',
        short_explanation: 'The source says the mayor announced a tax.',
        evidence: 'mayor announced ... tax',
        misconception: 'The student missed the negation in the source sentence.',
        study_tip: 'Check whether the source denies the evidence claim.',
      }),
      {
        deterministicResult: 'incorrect',
        sourceContextText: 'The mayor announced no tax.',
      },
    )

    expect(parsed).toMatchObject({
      status: 'failed',
      failureCode: 'unsupported_evidence',
    })
  })

  it('rejects ellipsis evidence that hides contracted source negation', () => {
    const parsed = parseObjectiveExplanationOutput(
      JSON.stringify({
        result: 'incorrect',
        short_explanation: 'The source says the mayor announced a tax.',
        evidence: 'mayor ... tax',
        misconception: 'The student missed the negation in the source sentence.',
        study_tip: 'Check whether the source denies the evidence claim.',
      }),
      {
        deterministicResult: 'incorrect',
        sourceContextText: "The mayor didn't announce a tax.",
      },
    )

    expect(parsed).toMatchObject({
      status: 'failed',
      failureCode: 'unsupported_evidence',
    })
  })

  it.each([
    'The rules dont allow tax increases.',
    'The rules wont allow tax increases.',
    'The rules arent allowing tax increases.',
    'The rules couldnt allow tax increases.',
    'The rules shouldnt allow tax increases.',
    'The rules wouldnt allow tax increases.',
  ])('rejects ellipsis evidence that hides bare contracted source negation: %s', (sourceContextText) => {
    const parsed = parseObjectiveExplanationOutput(
      JSON.stringify({
        result: 'incorrect',
        short_explanation: 'The source says the rules allow tax increases.',
        evidence: 'rules ... tax increases',
        misconception: 'The student missed the negation in the source sentence.',
        study_tip: 'Check whether the source denies the evidence claim.',
      }),
      {
        deterministicResult: 'incorrect',
        sourceContextText,
      },
    )

    expect(parsed).toMatchObject({
      status: 'failed',
      failureCode: 'unsupported_evidence',
    })
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
