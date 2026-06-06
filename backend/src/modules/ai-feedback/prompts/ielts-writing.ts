/**
 * File: src/modules/ai-feedback/prompts/ielts-writing.ts
 * Purpose: Build deterministic IELTS writing feedback provider requests.
 * Why: Keeps grading instructions stable, testable, and independent from provider adapters.
 */
import type {
  AiConcreteProviderRouteKey,
  AiProviderImageContentPart,
  AiProviderRequest,
  AiProviderTextContentPart,
} from '../provider.types.js'
import { buildIeltsWritingCriteriaPromptPack } from '../criteria/criteria.service.js'
import {
  IELTS_WRITING_FEEDBACK_PROMPT_VERSION,
  buildIeltsWritingSystemMessage,
} from './system.js'

type AssignmentAiPolicyInput = {
  writingFeedbackMode?: string
  objectiveExplanations?: string
  providerTier?: 'auto' | AiConcreteProviderRouteKey
}

type AssignmentInput = {
  title: string
  type: 'writing'
  config: {
    version?: number
    instructions?: string
    aiPolicy?: AssignmentAiPolicyInput
  }
}

type WritingTaskInput = {
  prompt: string
  visualType?: string
  imageContext?: IeltsWritingTask1ImageContext
}

type WritingSubmissionInput = {
  task1?: {
    text?: string
  }
  task2?: {
    text?: string
  }
}

export type IeltsWritingFeedbackPromptInput = {
  assignment: AssignmentInput
  tasks: {
    task1: WritingTaskInput
    task2: WritingTaskInput
  }
  submission: WritingSubmissionInput
  teacherConstraints?: string[]
}

export type IeltsWritingTask1ImageContextStatus =
  | 'not_visual'
  | 'image_attached'
  | 'image_unavailable'
  | 'teacher_summary_supplemental'
  | 'fallback_only'

type IeltsWritingTask1ImageContext =
  | {
      status: 'image_attached'
      image: AiProviderImageContentPart
      teacherSummary?: string
    }
  | {
      status: 'teacher_summary_supplemental'
      teacherSummary: string
    }
  | {
      status: 'image_unavailable' | 'fallback_only'
      reason: string
      teacherSummary?: string
    }

export type BuiltIeltsWritingFeedbackPrompt = {
  promptVersion: typeof IELTS_WRITING_FEEDBACK_PROMPT_VERSION
  request: AiProviderRequest
  imageContextStatus: IeltsWritingTask1ImageContextStatus
  imageContextFailure?: {
    failureCode: 'image_context_unavailable'
    failureMessage: string
  }
}

function cleanText(value: string | undefined): string {
  return (value ?? '').trim()
}

function routePreference(
  policy: AssignmentAiPolicyInput | undefined,
): AiConcreteProviderRouteKey | undefined {
  return policy?.providerTier === 'low_cost' || policy?.providerTier === 'premium'
    ? policy.providerTier
    : undefined
}

function isVisualTask1(input: IeltsWritingFeedbackPromptInput): boolean {
  return cleanText(input.tasks.task1.visualType).length > 0
}

function resolveTask1ImageContextStatus(
  input: IeltsWritingFeedbackPromptInput,
): IeltsWritingTask1ImageContextStatus {
  const context = input.tasks.task1.imageContext

  if (!isVisualTask1(input)) {
    return 'not_visual'
  }

  return context?.status ?? 'fallback_only'
}

function imageContextFailure(
  status: IeltsWritingTask1ImageContextStatus,
  context: IeltsWritingTask1ImageContext | undefined,
): BuiltIeltsWritingFeedbackPrompt['imageContextFailure'] {
  if (status !== 'image_unavailable') {
    return undefined
  }

  return {
    failureCode: 'image_context_unavailable',
    failureMessage: context?.status === 'image_unavailable' ? context.reason : 'Required image context is unavailable.',
  }
}

function buildTask1ImageContextPayload(
  input: IeltsWritingFeedbackPromptInput,
  status: IeltsWritingTask1ImageContextStatus,
) {
  const context = input.tasks.task1.imageContext
  const payload: Record<string, string | boolean> = {
    status,
  }

  if (
    context?.status === 'image_attached' ||
    context?.status === 'teacher_summary_supplemental' ||
    context?.status === 'fallback_only' ||
    context?.status === 'image_unavailable'
  ) {
    const teacherSummary = cleanText(context.teacherSummary)
    if (teacherSummary) {
      payload.teacher_summary = teacherSummary
    }
  }

  if (context?.status === 'image_unavailable' || context?.status === 'fallback_only') {
    payload.reason = context.reason
  }

  if (status === 'image_unavailable') {
    payload.harness_signal = 'image_context_unavailable'
  }

  return payload
}

function buildUserPayload(
  input: IeltsWritingFeedbackPromptInput,
  imageContextStatus: IeltsWritingTask1ImageContextStatus,
) {
  const aiPolicy = input.assignment.config.aiPolicy
  const criteriaPack = buildIeltsWritingCriteriaPromptPack('combined')

  return {
    prompt_version: IELTS_WRITING_FEEDBACK_PROMPT_VERSION,
    assignment: {
      title: cleanText(input.assignment.title),
      type: input.assignment.type,
      config_version: input.assignment.config.version ?? 1,
      instructions: cleanText(input.assignment.config.instructions),
      ai_policy: {
        writing_feedback_mode: aiPolicy?.writingFeedbackMode ?? 'off',
        objective_explanations: aiPolicy?.objectiveExplanations ?? 'off',
        provider_tier: aiPolicy?.providerTier ?? 'auto',
      },
    },
    tasks: {
      task1: {
        prompt: cleanText(input.tasks.task1.prompt),
        visual_type: cleanText(input.tasks.task1.visualType),
        image_context: buildTask1ImageContextPayload(input, imageContextStatus),
      },
      task2: {
        prompt: cleanText(input.tasks.task2.prompt),
      },
    },
    submission: {
      task1_text: cleanText(input.submission.task1?.text),
      task2_text: cleanText(input.submission.task2?.text),
    },
    criteria_pack: {
      criteria_version: criteriaPack.criteriaVersion,
      scope: criteriaPack.scope,
      expected_criterion_ids: criteriaPack.expectedCriterionIds,
      criteria: criteriaPack.criteria,
      task_weights: criteriaPack.taskWeights,
      criteria_guardrails: criteriaPack.guardrails,
    },
    teacher_constraints: (input.teacherConstraints ?? []).map(cleanText),
  }
}

function buildUserMessageContent(
  input: IeltsWritingFeedbackPromptInput,
  imageContextStatus: IeltsWritingTask1ImageContextStatus,
): string | [AiProviderTextContentPart, AiProviderImageContentPart] {
  const textPart: AiProviderTextContentPart = {
    type: 'text',
    text: JSON.stringify(buildUserPayload(input, imageContextStatus), null, 2),
  }
  const image = input.tasks.task1.imageContext?.status === 'image_attached'
    ? input.tasks.task1.imageContext.image
    : undefined

  return image ? [textPart, image] : textPart.text
}

export function buildIeltsWritingFeedbackPrompt(
  input: IeltsWritingFeedbackPromptInput,
): BuiltIeltsWritingFeedbackPrompt {
  const preferredRoute = routePreference(input.assignment.config.aiPolicy)
  const imageContextStatus = resolveTask1ImageContextStatus(input)
  const failure = imageContextFailure(
    imageContextStatus,
    input.tasks.task1.imageContext,
  )
  const request: AiProviderRequest = {
    taskType: 'writing_feedback',
    messages: [
      buildIeltsWritingSystemMessage(),
      {
        role: 'user',
        content: buildUserMessageContent(input, imageContextStatus),
      },
    ],
    assignmentPolicy: {
      highStakes: false,
      ...(preferredRoute ? { preferredRoute } : {}),
    },
    requiresImageInput: imageContextStatus === 'image_attached',
    expectJson: true,
    temperature: 0,
  }

  return {
    promptVersion: IELTS_WRITING_FEEDBACK_PROMPT_VERSION,
    request,
    imageContextStatus,
    ...(failure ? { imageContextFailure: failure } : {}),
  }
}
