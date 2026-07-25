/**
 * File: tests/modules/ai-feedback/ai-feedback.auditBounds.test.ts
 * Purpose: Verify AI producer inputs cannot exceed audit contract identifiers and labels.
 * Why: Generation must reject unauditable values before persistence or enqueue side effects.
 */
import { describe, expect, it } from 'vitest'

import {
  createAiFeedbackDraftSchema,
  objectiveExplanationRequestParamsSchema,
  upsertAiObjectiveExplanationSchema,
} from '../../../src/modules/ai-feedback/ai-feedback.schema.js'
import { objectiveGenerationJobSchema } from '../../../src/modules/ai-feedback/ai-feedback.generationJob.schema.js'
import { objectiveHarnessFixtures } from '../../fixtures/ai-feedback/harness/harness.fixtures.js'

const submissionId = '2520f0dd-918a-4c2b-9544-b922eac066e5'
const assignmentId = '7a7510e2-5fac-46e6-a2d1-6d30c87bcc0c'
const requesterId = 'db2b572b-ef7d-44b3-96c6-a61c498cf673'

function writingDraftInput(model: string) {
  return {
    submissionId,
    assignmentId,
    requesterId,
    promptVersion: 'writing-v1',
    routeKey: 'low_cost',
    provider: 'openai-compatible',
    model,
    inputHash: 'input-hash',
    status: 'accepted',
    visibilityMode: 'teacher_reviewed',
    generatedFeedback: {},
  }
}

function objectiveExplanationInput(questionId: string) {
  return {
    submissionId,
    assignmentId,
    requesterId,
    questionId,
    deterministicResult: 'incorrect',
    promptVersion: 'objective-v1',
    sourceContextHash: 'source-hash',
    routeKey: 'premium',
    provider: 'openai-compatible',
    model: 'gpt-test',
    status: 'completed',
    generatedExplanation: {},
  }
}

describe('AI feedback audit boundaries', () => {
  it('accepts 120-character models and rejects 121-character models', () => {
    expect(
      createAiFeedbackDraftSchema.safeParse(writingDraftInput('m'.repeat(120))).success,
    ).toBe(true)
    expect(
      createAiFeedbackDraftSchema.safeParse(writingDraftInput('m'.repeat(121))).success,
    ).toBe(false)
  })

  it('accepts 160-character question IDs and rejects 161-character IDs', () => {
    const acceptedId = 'q'.repeat(160)
    const rejectedId = 'q'.repeat(161)

    expect(
      upsertAiObjectiveExplanationSchema.safeParse(objectiveExplanationInput(acceptedId))
        .success,
    ).toBe(true)
    expect(
      upsertAiObjectiveExplanationSchema.safeParse(objectiveExplanationInput(rejectedId))
        .success,
    ).toBe(false)
    expect(
      objectiveExplanationRequestParamsSchema.safeParse({
        submissionId,
        questionId: rejectedId,
      }).success,
    ).toBe(false)
  })

  it('rejects unauditable question IDs in queued objective jobs', () => {
    const harnessInput = structuredClone(objectiveHarnessFixtures[0])
    harnessInput.promptInput.question.id = 'q'.repeat(161)

    expect(objectiveGenerationJobSchema.safeParse({ harnessInput }).success).toBe(false)
  })
})
