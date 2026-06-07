/**
 * File: src/modules/ai-feedback/harness/harness.service.ts
 * Purpose: Run deterministic AI feedback harness evaluations without provider calls.
 * Why: Runtime jobs need a reusable prompt/parse/guardrail path before persisting AI output.
 */
import { IELTS_WRITING_CRITERIA_VERSION } from '../criteria/criteria.service.js'
import { parseObjectiveExplanationOutput, parseWritingFeedbackOutput } from '../parser.js'
import type { AiProviderMessage, AiProviderMessageContent } from '../provider.types.js'
import {
  buildIeltsWritingFeedbackPrompt,
  buildObjectiveExplanationPrompt,
} from '../prompts/index.js'
import type {
  AiFeedbackHarnessInput,
  AiFeedbackHarnessReasonCode,
  AiFeedbackHarnessRequestAudit,
  AiFeedbackHarnessResult,
  AiFeedbackHarnessStatus,
  AiFeedbackHarnessTokenEstimate,
  ObjectiveExplanationHarnessInput,
  WritingFeedbackHarnessInput,
} from './harness.types.js'
export {
  buildAiFeedbackHarnessReport,
  serializeAiFeedbackHarnessReport,
} from './harness.reporter.js'

const DEFAULT_ROUTE_KEY = 'harness-route'
const REVIEW_CONFIDENCE_THRESHOLD = 0.6

function messageContentKinds(content: AiProviderMessageContent): string[] {
  if (typeof content === 'string') {
    return ['text']
  }

  return content.map((part) => part.type)
}

function buildRequestAudit(
  messages: AiProviderMessage[],
  input: {
    taskType: AiFeedbackHarnessResult['taskType']
    expectJson?: boolean
    requiresImageInput?: boolean
    imageContextStatus?: AiFeedbackHarnessRequestAudit['imageContextStatus']
  },
): AiFeedbackHarnessRequestAudit {
  return {
    taskType: input.taskType,
    expectJson: input.expectJson === true,
    requiresImageInput: input.requiresImageInput === true,
    messageContentKinds: messages.map((message) => messageContentKinds(message.content)),
    ...(input.imageContextStatus ? { imageContextStatus: input.imageContextStatus } : {}),
  }
}

function estimateTextTokens(value: string): number {
  const trimmed = value.trim()

  return trimmed ? Math.max(1, Math.ceil(trimmed.length / 4)) : 0
}

function serializeContentForEstimate(content: AiProviderMessageContent): string {
  if (typeof content === 'string') {
    return content
  }

  return content
    .map((part) => (part.type === 'text' ? part.text : `${part.mimeType}:image`))
    .join('\n')
}

function estimateTokens(
  messages: AiProviderMessage[],
  providerOutput: string,
): AiFeedbackHarnessTokenEstimate {
  const promptTokens = messages.reduce(
    (sum, message) =>
      sum + estimateTextTokens(serializeContentForEstimate(message.content)),
    0,
  )
  const completionTokens = estimateTextTokens(providerOutput)

  return {
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
  }
}

function buildResult(input: {
  fixtureId: string
  taskType: AiFeedbackHarnessResult['taskType']
  status: AiFeedbackHarnessStatus
  reasonCode: AiFeedbackHarnessReasonCode
  promptVersion: string
  criteriaVersion?: string
  routeKey?: string
  validationErrors?: string[]
  requestAudit: AiFeedbackHarnessRequestAudit
  tokenEstimate: AiFeedbackHarnessTokenEstimate
}): AiFeedbackHarnessResult {
  return {
    fixtureId: input.fixtureId,
    taskType: input.taskType,
    status: input.status,
    reasonCode: input.reasonCode,
    promptVersion: input.promptVersion,
    ...(input.criteriaVersion ? { criteriaVersion: input.criteriaVersion } : {}),
    routeKey: input.routeKey ?? DEFAULT_ROUTE_KEY,
    validationErrors: input.validationErrors ?? [],
    requestAudit: input.requestAudit,
    tokenEstimate: input.tokenEstimate,
  }
}

function classifyParserFailure(
  failureCode: AiFeedbackHarnessReasonCode,
): AiFeedbackHarnessStatus {
  if (
    failureCode === 'empty_feedback' ||
    failureCode === 'malformed_json' ||
    failureCode === 'schema_invalid'
  ) {
    return 'failed'
  }

  return 'rejected'
}

function visualImageContextReview(input: {
  allowVisualImageFallback?: boolean
  imageContextStatus: AiFeedbackHarnessRequestAudit['imageContextStatus']
}): {
  reasonCode: 'image_context_unavailable'
  message: string
} | null {
  if (
    input.imageContextStatus === 'not_visual' ||
    input.imageContextStatus === 'image_attached'
  ) {
    return null
  }

  const teacherApprovedFallback =
    input.allowVisualImageFallback === true &&
    (input.imageContextStatus === 'fallback_only' ||
      input.imageContextStatus === 'teacher_summary_supplemental')

  if (teacherApprovedFallback) {
    return null
  }

  return {
    reasonCode: 'image_context_unavailable',
    message: 'Required Task 1 image context is unavailable for provider evaluation.',
  }
}

function evaluateWritingHarness(
  input: WritingFeedbackHarnessInput,
): AiFeedbackHarnessResult {
  const builtPrompt = buildIeltsWritingFeedbackPrompt(input.promptInput)
  const requestAudit = buildRequestAudit(builtPrompt.request.messages, {
    taskType: 'writing_feedback',
    expectJson: builtPrompt.request.expectJson,
    requiresImageInput: builtPrompt.request.requiresImageInput,
    imageContextStatus: builtPrompt.imageContextStatus,
  })
  const tokenEstimate = estimateTokens(builtPrompt.request.messages, input.providerOutput)
  const imageContextReview = visualImageContextReview({
    allowVisualImageFallback: input.allowVisualImageFallback,
    imageContextStatus: builtPrompt.imageContextStatus,
  })

  if (imageContextReview) {
    return buildResult({
      fixtureId: input.fixtureId,
      taskType: 'writing_feedback',
      status: 'review_required',
      reasonCode: imageContextReview.reasonCode,
      promptVersion: builtPrompt.promptVersion,
      criteriaVersion: IELTS_WRITING_CRITERIA_VERSION,
      routeKey: input.routeKey,
      validationErrors: [imageContextReview.message],
      requestAudit,
      tokenEstimate,
    })
  }

  const parsed = parseWritingFeedbackOutput(input.providerOutput, {
    writingScope: 'combined',
  })

  if (parsed.status !== 'accepted') {
    const reasonCode = parsed.failureCode as AiFeedbackHarnessReasonCode

    return buildResult({
      fixtureId: input.fixtureId,
      taskType: 'writing_feedback',
      status: classifyParserFailure(reasonCode),
      reasonCode,
      promptVersion: builtPrompt.promptVersion,
      criteriaVersion: IELTS_WRITING_CRITERIA_VERSION,
      routeKey: input.routeKey,
      validationErrors: [parsed.failureMessage],
      requestAudit,
      tokenEstimate,
    })
  }

  if (parsed.feedback.confidence < REVIEW_CONFIDENCE_THRESHOLD) {
    return buildResult({
      fixtureId: input.fixtureId,
      taskType: 'writing_feedback',
      status: 'review_required',
      reasonCode: 'low_confidence',
      promptVersion: builtPrompt.promptVersion,
      criteriaVersion: parsed.criteriaVersion,
      routeKey: input.routeKey,
      validationErrors: ['Accepted output is below the harness confidence threshold.'],
      requestAudit,
      tokenEstimate,
    })
  }

  return buildResult({
    fixtureId: input.fixtureId,
    taskType: 'writing_feedback',
    status: 'accepted',
    reasonCode: 'accepted',
    promptVersion: builtPrompt.promptVersion,
    criteriaVersion: parsed.criteriaVersion,
    routeKey: input.routeKey,
    requestAudit,
    tokenEstimate,
  })
}

function objectiveSourceContextFailure(input: ObjectiveExplanationHarnessInput): {
  reasonCode: 'missing_passage_context' | 'missing_transcript_context'
  message: string
} | null {
  const context = input.promptInput.sourceContext

  if (input.promptInput.assignment.type === 'reading') {
    if (context?.kind !== 'reading_passage' || !context.text.trim()) {
      return {
        reasonCode: 'missing_passage_context',
        message: 'Reading objective explanations require passage text context.',
      }
    }
    return null
  }

  if (context?.kind !== 'listening_transcript' || !context.text.trim()) {
    return {
      reasonCode: 'missing_transcript_context',
      message: 'Listening objective explanations require transcript text context.',
    }
  }

  return null
}

function evaluateObjectiveHarness(
  input: ObjectiveExplanationHarnessInput,
): AiFeedbackHarnessResult {
  const builtPrompt = buildObjectiveExplanationPrompt(input.promptInput)
  const requestAudit = buildRequestAudit(builtPrompt.request.messages, {
    taskType: 'objective_explanation',
    expectJson: builtPrompt.request.expectJson,
    requiresImageInput: builtPrompt.request.requiresImageInput,
  })
  const tokenEstimate = estimateTokens(builtPrompt.request.messages, input.providerOutput)
  const contextFailure = objectiveSourceContextFailure(input)

  if (contextFailure) {
    return buildResult({
      fixtureId: input.fixtureId,
      taskType: 'objective_explanation',
      status: 'review_required',
      reasonCode: contextFailure.reasonCode,
      promptVersion: builtPrompt.promptVersion,
      routeKey: input.routeKey,
      validationErrors: [contextFailure.message],
      requestAudit,
      tokenEstimate,
    })
  }

  const parsed = parseObjectiveExplanationOutput(input.providerOutput, {
    deterministicResult: input.promptInput.deterministicResult,
  })

  if (parsed.status !== 'completed') {
    const reasonCode = parsed.failureCode as AiFeedbackHarnessReasonCode

    return buildResult({
      fixtureId: input.fixtureId,
      taskType: 'objective_explanation',
      status: classifyParserFailure(reasonCode),
      reasonCode,
      promptVersion: builtPrompt.promptVersion,
      routeKey: input.routeKey,
      validationErrors: [parsed.failureMessage],
      requestAudit,
      tokenEstimate,
    })
  }

  return buildResult({
    fixtureId: input.fixtureId,
    taskType: 'objective_explanation',
    status: 'accepted',
    reasonCode: 'accepted',
    promptVersion: builtPrompt.promptVersion,
    routeKey: input.routeKey,
    requestAudit,
    tokenEstimate,
  })
}

export function evaluateAiFeedbackHarness(
  input: AiFeedbackHarnessInput,
): AiFeedbackHarnessResult {
  try {
    return input.taskType === 'writing_feedback'
      ? evaluateWritingHarness(input)
      : evaluateObjectiveHarness(input)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown harness error.'

    return buildResult({
      fixtureId: input.fixtureId,
      taskType: input.taskType,
      status: 'failed',
      reasonCode: 'harness_exception',
      promptVersion: 'unknown',
      routeKey: input.routeKey,
      validationErrors: [message],
      requestAudit: {
        taskType: input.taskType,
        expectJson: false,
        requiresImageInput: false,
        messageContentKinds: [],
      },
      tokenEstimate: {
        promptTokens: 0,
        completionTokens: estimateTextTokens(input.providerOutput),
        totalTokens: estimateTextTokens(input.providerOutput),
      },
    })
  }
}

export function runAiFeedbackHarness(
  inputs: AiFeedbackHarnessInput[],
): AiFeedbackHarnessResult[] {
  return inputs.map(evaluateAiFeedbackHarness)
}
