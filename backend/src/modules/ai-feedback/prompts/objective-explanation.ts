/**
 * File: src/modules/ai-feedback/prompts/objective-explanation.ts
 * Purpose: Build deterministic reading/listening objective explanation requests.
 * Why: Explanations must stay tied to server scoring and available source context.
 */
import type { AiConcreteProviderRouteKey, AiProviderRequest } from '../provider.types.js'
import {
  OBJECTIVE_EXPLANATION_PROMPT_VERSION,
  buildObjectiveExplanationSystemMessage,
} from './system.js'

type AssignmentAiPolicyInput = {
  writingFeedbackMode?: string
  objectiveExplanations?: string
  providerTier?: 'auto' | AiConcreteProviderRouteKey
}

type ObjectiveAssignmentInput = {
  title: string
  type: 'reading' | 'listening'
  config: {
    version?: number
    aiPolicy?: AssignmentAiPolicyInput
  }
}

type ObjectiveQuestionInput = {
  id: string
  text: string
  acceptedAnswer: string
}

type ObjectiveSourceContextInput =
  | {
      kind: 'reading_passage' | 'listening_transcript'
      text: string
    }
  | {
      kind: 'listening_audio_file'
      audioFileId: string
    }

export type ObjectiveExplanationPromptInput = {
  assignment: ObjectiveAssignmentInput
  question: ObjectiveQuestionInput
  studentAnswer: unknown
  deterministicResult: string
  sourceContext?: ObjectiveSourceContextInput
}

export type BuiltObjectiveExplanationPrompt = {
  promptVersion: typeof OBJECTIVE_EXPLANATION_PROMPT_VERSION
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

function serializeStudentAnswer(answer: unknown): string | null {
  if (answer === null || answer === undefined) {
    return null
  }

  if (typeof answer === 'string') {
    return answer.trim()
  }

  return JSON.stringify(answer) ?? null
}

function buildSourceContext(context: ObjectiveSourceContextInput | undefined) {
  if (!context) {
    return {
      kind: 'none',
      limitation: 'No passage, transcript, or source context was provided.',
    }
  }

  if (context.kind === 'listening_audio_file') {
    return {
      kind: context.kind,
      audio_file_id: cleanText(context.audioFileId),
      limitation:
        'Audio file ID only; the explanation must not pretend to inspect audio.',
    }
  }

  return {
    kind: context.kind,
    text: cleanText(context.text),
  }
}

function buildUserPayload(input: ObjectiveExplanationPromptInput) {
  const aiPolicy = input.assignment.config.aiPolicy

  return {
    prompt_version: OBJECTIVE_EXPLANATION_PROMPT_VERSION,
    assignment: {
      title: cleanText(input.assignment.title),
      type: input.assignment.type,
      config_version: input.assignment.config.version ?? 1,
      ai_policy: {
        writing_feedback_mode: aiPolicy?.writingFeedbackMode ?? 'off',
        objective_explanations: aiPolicy?.objectiveExplanations ?? 'off',
        provider_tier: aiPolicy?.providerTier ?? 'auto',
      },
    },
    question: {
      id: cleanText(input.question.id),
      text: cleanText(input.question.text),
      accepted_answer: cleanText(input.question.acceptedAnswer),
    },
    student_answer: serializeStudentAnswer(input.studentAnswer),
    deterministic_result: cleanText(input.deterministicResult),
    source_context: buildSourceContext(input.sourceContext),
  }
}

export function buildObjectiveExplanationPrompt(
  input: ObjectiveExplanationPromptInput,
): BuiltObjectiveExplanationPrompt {
  const preferredRoute = routePreference(input.assignment.config.aiPolicy)
  const request: AiProviderRequest = {
    taskType: 'objective_explanation',
    messages: [
      buildObjectiveExplanationSystemMessage(),
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
    promptVersion: OBJECTIVE_EXPLANATION_PROMPT_VERSION,
    request,
  }
}
