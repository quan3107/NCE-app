/**
 * File: tests/modules/ai-feedback/harness/harness.service.test.ts
 * Purpose: Verify provider-free AI feedback harness evaluation.
 * Why: Queue workers need deterministic prompt/parse/guardrail proof before storing AI output.
 */
import { describe, expect, it } from 'vitest'

import {
  buildAiFeedbackHarnessReport,
  evaluateAiFeedbackHarness,
  runAiFeedbackHarness,
  serializeAiFeedbackHarnessReport,
} from '../../../../src/modules/ai-feedback/harness/harness.service.js'
import {
  aiHarnessRegressionCorpus,
  objectiveHarnessFixtures,
  writingHarnessFixtures,
} from '../../../fixtures/ai-feedback/harness/harness.fixtures.js'

const writingById = Object.fromEntries(
  writingHarnessFixtures.map((fixture) => [fixture.fixtureId, fixture]),
)
const objectiveById = Object.fromEntries(
  objectiveHarnessFixtures.map((fixture) => [fixture.fixtureId, fixture]),
)

describe('evaluateAiFeedbackHarness', () => {
  it('accepts valid writing feedback through the runtime prompt and parser path', () => {
    const result = evaluateAiFeedbackHarness(writingById.valid_writing_feedback)

    expect(result).toMatchObject({
      fixtureId: 'valid_writing_feedback',
      taskType: 'writing_feedback',
      status: 'accepted',
      promptVersion: 'ielts-writing-feedback-v1',
      criteriaVersion: 'ielts-writing-criteria-v1',
      routeKey: 'harness-route',
      reasonCode: 'accepted',
    })
    expect(result.requestAudit).toMatchObject({
      requiresImageInput: false,
      messageContentKinds: [['text'], ['text']],
    })
    expect(result.tokenEstimate.promptTokens).toBeGreaterThan(0)
    expect(result.tokenEstimate.completionTokens).toBeGreaterThan(0)
  })

  it('proves attached visual Task 1 image context reaches the provider request path', () => {
    const result = evaluateAiFeedbackHarness(writingById.visual_task1_image_attached)

    expect(result.status).toBe('accepted')
    expect(result.requestAudit).toMatchObject({
      requiresImageInput: true,
      imageContextStatus: 'image_attached',
      messageContentKinds: [['text'], ['text', 'image']],
    })
  })

  it('downgrades unavailable visual Task 1 image context before accepting output', () => {
    const result = evaluateAiFeedbackHarness(writingById.visual_task1_image_unavailable)

    expect(result).toMatchObject({
      status: 'review_required',
      reasonCode: 'image_context_unavailable',
      validationErrors: [
        'Required Task 1 image context is unavailable for provider evaluation.',
      ],
    })
    expect(result.requestAudit.imageContextStatus).toBe('image_unavailable')
  })

  it('requires attached image context or explicit teacher-approved fallback for visual Task 1', () => {
    expect(
      evaluateAiFeedbackHarness(writingById.visual_task1_missing_image_context),
    ).toMatchObject({
      status: 'review_required',
      reasonCode: 'image_context_unavailable',
      requestAudit: {
        imageContextStatus: 'fallback_only',
        requiresImageInput: false,
        messageContentKinds: [['text'], ['text']],
      },
    })

    expect(
      evaluateAiFeedbackHarness(writingById.visual_task1_teacher_summary_only),
    ).toMatchObject({
      status: 'review_required',
      reasonCode: 'image_context_unavailable',
      requestAudit: {
        imageContextStatus: 'teacher_summary_supplemental',
      },
    })

    expect(
      evaluateAiFeedbackHarness(writingById.visual_task1_teacher_approved_fallback),
    ).toMatchObject({
      status: 'accepted',
      reasonCode: 'accepted',
      requestAudit: {
        imageContextStatus: 'teacher_summary_supplemental',
      },
    })
  })

  it('classifies known-bad writing outputs with stable reason codes', () => {
    expect(evaluateAiFeedbackHarness(writingById.markdown_wrapped_json)).toMatchObject({
      status: 'accepted',
      reasonCode: 'accepted',
    })

    const expectedFailures = {
      malformed_json: ['failed', 'malformed_json'],
      unknown_criteria: ['rejected', 'unknown_criteria'],
      missing_criteria: ['rejected', 'missing_criteria'],
      duplicated_criteria: ['rejected', 'duplicate_criteria'],
      invalid_bands: ['rejected', 'invalid_criteria_band'],
      invented_weighting: ['rejected', 'invented_weighting'],
      unsafe_advice: ['rejected', 'unsafe_output'],
      off_task_output: ['rejected', 'off_task_output'],
    } as const

    for (const [fixtureId, [status, reasonCode]] of Object.entries(expectedFailures)) {
      expect(evaluateAiFeedbackHarness(writingById[fixtureId])).toMatchObject({
        fixtureId,
        status,
        reasonCode,
      })
    }
  })

  it('accepts objective explanations and downgrades unsupported source context', () => {
    expect(
      evaluateAiFeedbackHarness(objectiveById.valid_reading_explanation),
    ).toMatchObject({
      status: 'accepted',
      reasonCode: 'accepted',
      promptVersion: 'objective-explanation-v1',
    })

    expect(
      evaluateAiFeedbackHarness(objectiveById.missing_passage_context),
    ).toMatchObject({
      status: 'review_required',
      reasonCode: 'missing_passage_context',
    })

    expect(
      evaluateAiFeedbackHarness(objectiveById.missing_transcript_context),
    ).toMatchObject({
      status: 'review_required',
      reasonCode: 'missing_transcript_context',
    })
  })

  it('rejects objective explanation score override attempts', () => {
    expect(evaluateAiFeedbackHarness(objectiveById.score_override_attempt)).toMatchObject(
      {
        status: 'rejected',
        reasonCode: 'score_override_attempt',
      },
    )
  })
})

describe('buildAiFeedbackHarnessReport', () => {
  it('emits scrubbed machine-readable report rows and summary counts', () => {
    const results = runAiFeedbackHarness([
      writingById.valid_writing_feedback,
      writingById.visual_task1_image_unavailable,
      writingById.unsafe_advice,
      writingById.malformed_json,
      objectiveById.valid_reading_explanation,
    ])
    const report = buildAiFeedbackHarnessReport(results)

    expect(report.summary).toEqual({
      accepted: 2,
      review_required: 1,
      rejected: 1,
      failed: 1,
    })
    expect(report.rows).toHaveLength(5)
    expect(report.rows[0]).toEqual(
      expect.objectContaining({
        fixtureId: 'valid_writing_feedback',
        status: 'accepted',
        promptVersion: 'ielts-writing-feedback-v1',
        criteriaVersion: 'ielts-writing-criteria-v1',
        routeKey: 'harness-route',
      }),
    )

    const serialized = serializeAiFeedbackHarnessReport(report)
    expect(serialized).toContain('"fixtureId": "valid_writing_feedback"')
    expect(serialized).not.toContain('The chart rose from 40 to 70 percent')
    expect(serialized).not.toContain('share account passwords')
  })
})

describe('AI harness regression corpus', () => {
  it('runs the named deterministic corpus and reports every terminal status', () => {
    const results = runAiFeedbackHarness(aiHarnessRegressionCorpus.fixtures)
    const report = buildAiFeedbackHarnessReport(results)

    expect(report.summary).toEqual(aiHarnessRegressionCorpus.expectedSummary)
    expect(report.rows).toHaveLength(aiHarnessRegressionCorpus.fixtures.length)

    for (const requiredCategory of [
      'teacher_reviewed_writing',
      'instant_visible_writing',
      'visual_task1',
      'objective_explanation',
      'provider_output_shape',
      'safety_policy',
      'provider_route_shape',
    ]) {
      expect(aiHarnessRegressionCorpus.coverageCategories).toContain(requiredCategory)
    }

    expect(report.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fixtureId: 'weak_teacher_reviewed_writing',
          status: 'review_required',
          reasonCode: 'low_confidence',
        }),
        expect.objectContaining({
          fixtureId: 'strong_instant_visible_writing',
          status: 'accepted',
          reasonCode: 'accepted',
          routeKey: 'premium',
        }),
        expect.objectContaining({
          fixtureId: 'visual_task1_unsupported_image',
          status: 'review_required',
          reasonCode: 'image_context_unavailable',
        }),
        expect.objectContaining({
          fixtureId: 'listening_transcript_explanation',
          status: 'accepted',
          reasonCode: 'accepted',
        }),
        expect.objectContaining({
          fixtureId: 'objective_explanation_unsafe_advice',
          status: 'rejected',
          reasonCode: 'unsafe_output',
        }),
        expect.objectContaining({
          fixtureId: 'objective_hallucinated_evidence',
          status: 'rejected',
          reasonCode: 'unsupported_evidence',
        }),
        expect.objectContaining({
          fixtureId: 'gpt_5_4_nano_concise_writing',
          status: 'accepted',
          reasonCode: 'accepted',
          routeKey: 'low_cost',
        }),
        expect.objectContaining({
          fixtureId: 'gpt_5_4_mini_premium_writing',
          status: 'accepted',
          reasonCode: 'accepted',
          routeKey: 'premium',
        }),
      ]),
    )
  })

  it('keeps the corpus report scrubbed of raw submission and provider text', () => {
    const report = buildAiFeedbackHarnessReport(
      runAiFeedbackHarness(aiHarnessRegressionCorpus.fixtures),
    )
    const serialized = serializeAiFeedbackHarnessReport(report)

    expect(serialized).not.toContain('I copied this from the sample answer')
    expect(serialized).not.toContain('share account passwords')
    expect(serialized).not.toContain('The transcript says platform changes')
  })
})
