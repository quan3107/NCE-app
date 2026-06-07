/**
 * File: src/modules/ai-feedback/harness/harness.types.ts
 * Purpose: Define provider-free AI feedback harness contracts.
 * Why: Tests and queue workers need one deterministic shape for prompt, parser, and guardrail evaluation.
 */
import type { AiTaskType } from '../provider.types.js'
import type { IeltsWritingTask1ImageContextStatus } from '../prompts/ielts-writing.js'
import type { IeltsWritingFeedbackPromptInput } from '../prompts/ielts-writing.js'
import type { ObjectiveExplanationPromptInput } from '../prompts/objective-explanation.js'

export type AiFeedbackHarnessStatus =
  | 'accepted'
  | 'review_required'
  | 'rejected'
  | 'failed'

export type AiFeedbackHarnessReasonCode =
  | 'accepted'
  | 'low_confidence'
  | 'image_context_unavailable'
  | 'missing_passage_context'
  | 'missing_transcript_context'
  | 'empty_feedback'
  | 'malformed_json'
  | 'schema_invalid'
  | 'unknown_criteria'
  | 'duplicate_criteria'
  | 'missing_criteria'
  | 'wrong_task_criteria'
  | 'invalid_criteria_band'
  | 'invented_weighting'
  | 'unsafe_output'
  | 'off_task_output'
  | 'score_override_attempt'
  | 'harness_exception'

export type WritingFeedbackHarnessInput = {
  fixtureId: string
  taskType: 'writing_feedback'
  promptInput: IeltsWritingFeedbackPromptInput
  providerOutput: string
  routeKey?: string
}

export type ObjectiveExplanationHarnessInput = {
  fixtureId: string
  taskType: 'objective_explanation'
  promptInput: ObjectiveExplanationPromptInput
  providerOutput: string
  routeKey?: string
}

export type AiFeedbackHarnessInput =
  | WritingFeedbackHarnessInput
  | ObjectiveExplanationHarnessInput

export type AiFeedbackHarnessRequestAudit = {
  taskType: AiTaskType
  expectJson: boolean
  requiresImageInput: boolean
  messageContentKinds: string[][]
  imageContextStatus?: IeltsWritingTask1ImageContextStatus
}

export type AiFeedbackHarnessTokenEstimate = {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

export type AiFeedbackHarnessResult = {
  fixtureId: string
  taskType: AiTaskType
  status: AiFeedbackHarnessStatus
  reasonCode: AiFeedbackHarnessReasonCode
  promptVersion: string
  criteriaVersion?: string
  routeKey: string
  validationErrors: string[]
  requestAudit: AiFeedbackHarnessRequestAudit
  tokenEstimate: AiFeedbackHarnessTokenEstimate
}

export type AiFeedbackHarnessReportRow = {
  fixtureId: string
  taskType: AiTaskType
  status: AiFeedbackHarnessStatus
  reasonCode: AiFeedbackHarnessReasonCode
  promptVersion: string
  criteriaVersion?: string
  routeKey: string
  validationErrors: string[]
  tokenEstimate: AiFeedbackHarnessTokenEstimate
  requestAudit: AiFeedbackHarnessRequestAudit
}

export type AiFeedbackHarnessReport = {
  summary: Record<AiFeedbackHarnessStatus, number>
  rows: AiFeedbackHarnessReportRow[]
}
