/**
 * File: src/modules/ai-feedback/prompts/ielts-writing.ts
 * Purpose: Build deterministic IELTS writing feedback provider requests.
 * Why: Keeps grading instructions stable, testable, and independent from provider adapters.
 */
import type { AiConcreteProviderRouteKey, AiProviderRequest } from '../provider.types.js'
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

export type BuiltIeltsWritingFeedbackPrompt = {
  promptVersion: typeof IELTS_WRITING_FEEDBACK_PROMPT_VERSION
  request: AiProviderRequest
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

function buildUserPayload(input: IeltsWritingFeedbackPromptInput) {
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

export function buildIeltsWritingFeedbackPrompt(
  input: IeltsWritingFeedbackPromptInput,
): BuiltIeltsWritingFeedbackPrompt {
  const preferredRoute = routePreference(input.assignment.config.aiPolicy)
  const request: AiProviderRequest = {
    taskType: 'writing_feedback',
    messages: [
      buildIeltsWritingSystemMessage(),
      {
        role: 'user',
        content: JSON.stringify(buildUserPayload(input), null, 2),
      },
    ],
    assignmentPolicy: {
      highStakes: false,
      ...(preferredRoute ? { preferredRoute } : {}),
    },
    expectJson: true,
    temperature: 0,
  }

  return {
    promptVersion: IELTS_WRITING_FEEDBACK_PROMPT_VERSION,
    request,
  }
}
