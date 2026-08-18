/**
 * File: src/modules/ai-feedback/provider.openai-diagnostics.ts
 * Purpose: Classify empty chat completions using bounded safe metadata.
 * Why: Observability must distinguish failures without retaining provider prose.
 */
import { AiProviderError } from './provider.errors.js'
import type { AiConcreteProviderRouteKey } from './provider.types.js'

export type OpenAiChatChoice = {
  finish_reason?: unknown
  message?: {
    content?: unknown
    refusal?: unknown
  }
}

export type OpenAiChatUsage = {
  prompt_tokens?: unknown
  completion_tokens?: unknown
  total_tokens?: unknown
  completion_tokens_details?: { reasoning_tokens?: unknown }
}

export type ValidOpenAiChatChoice = OpenAiChatChoice & {
  message: NonNullable<OpenAiChatChoice['message']>
}

type EmptyCompletionDetails = {
  finishReason: string
  refusalPresent: boolean
  refusalCategory?: string
  completionTokens?: number
  reasoningTokens?: number
  maxOutputTokens: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function numberOrUndefined(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined
}

export function firstValidChatChoice(choices: unknown): ValidOpenAiChatChoice | null {
  if (!Array.isArray(choices) || !isRecord(choices[0])) {
    return null
  }
  const choice = choices[0] as OpenAiChatChoice
  return isRecord(choice.message) ? (choice as ValidOpenAiChatChoice) : null
}

function safeFinishReason(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) {
    return 'missing'
  }
  const normalized = value.trim().toLowerCase()
  return ['stop', 'length', 'content_filter', 'tool_calls', 'function_call'].includes(
    normalized,
  )
    ? normalized
    : 'other'
}

function refusalPresent(refusal: unknown): boolean {
  return typeof refusal === 'string' ? refusal.trim().length > 0 : isRecord(refusal)
}

function refusalCategory(refusal: unknown, finishReason: string): string | undefined {
  if (finishReason === 'content_filter') {
    return 'content_filter'
  }
  if (!isRecord(refusal)) {
    return refusalPresent(refusal) ? 'unspecified' : undefined
  }
  const category = refusal.category ?? refusal.type ?? refusal.code
  if (typeof category !== 'string') {
    return 'unspecified'
  }
  const normalized = category.trim().toLowerCase()
  return ['safety', 'policy', 'content_filter', 'copyright', 'privacy'].includes(
    normalized,
  )
    ? normalized
    : 'unspecified'
}

function completionDetails(
  choice: ValidOpenAiChatChoice,
  usage: OpenAiChatUsage | undefined,
  maxOutputTokens: number,
): EmptyCompletionDetails {
  const finishReason = safeFinishReason(choice.finish_reason)
  const hasRefusal = refusalPresent(choice.message.refusal)
  const completionTokens = numberOrUndefined(usage?.completion_tokens)
  const reasoningTokens = numberOrUndefined(
    usage?.completion_tokens_details?.reasoning_tokens,
  )
  return {
    finishReason,
    refusalPresent: hasRefusal,
    ...(hasRefusal || finishReason === 'content_filter'
      ? { refusalCategory: refusalCategory(choice.message.refusal, finishReason) }
      : {}),
    ...(completionTokens !== undefined ? { completionTokens } : {}),
    ...(reasoningTokens !== undefined ? { reasoningTokens } : {}),
    maxOutputTokens,
  }
}

export function classifyEmptyChatCompletion(input: {
  choice: ValidOpenAiChatChoice
  usage?: OpenAiChatUsage
  maxOutputTokens: number
  routeKey: AiConcreteProviderRouteKey
}): AiProviderError {
  const details = completionDetails(input.choice, input.usage, input.maxOutputTokens)
  if (details.refusalPresent || details.finishReason === 'content_filter') {
    return new AiProviderError({
      code: 'refusal',
      message: 'AI provider declined to generate content.',
      routeKey: input.routeKey,
      details,
    })
  }
  if (
    details.finishReason === 'length' ||
    (details.reasoningTokens !== undefined &&
      details.reasoningTokens > 0 &&
      details.completionTokens !== undefined &&
      details.completionTokens >= input.maxOutputTokens)
  ) {
    return new AiProviderError({
      code: 'output_budget_exhausted',
      message: 'AI provider exhausted the configured output budget.',
      routeKey: input.routeKey,
      details,
    })
  }
  return new AiProviderError({
    code: 'empty_content',
    message: 'AI provider returned empty content.',
    routeKey: input.routeKey,
    details,
  })
}
