/**
 * File: src/modules/ai-feedback/parser.ts
 * Purpose: Parse and validate provider output for AI feedback records.
 * Why: Unsafe, malformed, or schema-drifting model responses must fail closed before persistence.
 */
import { z } from 'zod'

import {
  CriteriaValidationError,
  normalizeIeltsWritingCriterionSuggestions,
} from './criteria/criteria.service.js'
import type { IeltsWritingTask } from './criteria/criteria.types.js'

type FailedAiOutput = {
  status: 'failed'
  failureCode:
    | 'empty_feedback'
    | 'malformed_json'
    | 'schema_invalid'
    | 'unknown_criteria'
    | 'duplicate_criteria'
    | 'missing_criteria'
    | 'wrong_task_criteria'
    | 'invalid_criteria_band'
    | 'unsafe_output'
    | 'off_task_output'
    | 'score_override_attempt'
  failureMessage: string
}

type JsonParseResult =
  | {
      kind: 'failed'
      failure: FailedAiOutput
    }
  | {
      kind: 'json'
      value: Record<string, unknown>
    }

const nonBlankStringSchema = z.string().trim().min(1)

const safetyFlagsSchema = z
  .object({
    unsafe: z.boolean(),
    reasons: z.array(nonBlankStringSchema).default([]),
  })
  .strict()

const writingCriterionSuggestionSchema = z
  .object({
    criterion_id: nonBlankStringSchema,
    band: z.number().min(0).max(9),
    rationale: nonBlankStringSchema,
  })
  .strict()

const writingFeedbackSchema = z
  .object({
    band_estimate: z.number().min(0).max(9),
    criterion_band_suggestions: z.array(writingCriterionSuggestionSchema).min(1),
    rationale: nonBlankStringSchema,
    strengths: z.array(nonBlankStringSchema).min(1),
    improvement_areas: z.array(nonBlankStringSchema).min(1),
    next_steps: z.array(nonBlankStringSchema).min(1),
    teacher_notes: nonBlankStringSchema,
    confidence: z.number().min(0).max(1),
    safety_flags: safetyFlagsSchema,
  })
  .strict()

const objectiveExplanationSchema = z
  .object({
    result: nonBlankStringSchema,
    short_explanation: nonBlankStringSchema,
    evidence: nonBlankStringSchema,
    misconception: nonBlankStringSchema,
    study_tip: nonBlankStringSchema,
  })
  .strict()

export type AcceptedWritingFeedbackOutput = {
  status: 'accepted'
  feedback: z.infer<typeof writingFeedbackSchema>
  criteriaVersion?: string
  normalizedCriterionSuggestions: Array<{
    criterionId: string
    band: number
    rationale: string
  }>
  safetyFlags: {
    unsafe: boolean
    reasons: string[]
  }
}

export type ParsedWritingFeedbackOutput = AcceptedWritingFeedbackOutput | FailedAiOutput

export type CompletedObjectiveExplanationOutput = {
  status: 'completed'
  explanation: z.infer<typeof objectiveExplanationSchema>
}

export type ParsedObjectiveExplanationOutput =
  | CompletedObjectiveExplanationOutput
  | FailedAiOutput

type WritingParseOptions = {
  expectedCriterionIds?: string[]
  writingTask?: IeltsWritingTask
}

type ObjectiveParseOptions = {
  deterministicResult: string
}

function failed(
  failureCode: FailedAiOutput['failureCode'],
  failureMessage: string,
): FailedAiOutput {
  return {
    status: 'failed',
    failureCode,
    failureMessage,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function extractJsonCandidate(rawText: string): string | null {
  const trimmed = rawText.trim()

  if (!trimmed) {
    return null
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced?.[1]) {
    return fenced[1].trim()
  }

  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return trimmed
  }

  return extractFirstBalancedObject(trimmed)
}

function extractFirstBalancedObject(text: string): string | null {
  const start = text.indexOf('{')

  if (start === -1) {
    return null
  }

  let depth = 0
  let inString = false
  let escaped = false

  for (let index = start; index < text.length; index += 1) {
    const character = text[index]

    if (escaped) {
      escaped = false
      continue
    }

    if (character === '\\') {
      escaped = inString
      continue
    }

    if (character === '"') {
      inString = !inString
      continue
    }

    if (inString) {
      continue
    }

    if (character === '{') {
      depth += 1
    }

    if (character === '}') {
      depth -= 1
      if (depth === 0) {
        return text.slice(start, index + 1)
      }
    }
  }

  return null
}

function parseJsonObject(rawText: string): JsonParseResult {
  if (!rawText.trim()) {
    return {
      kind: 'failed',
      failure: failed('empty_feedback', 'Provider output was empty.'),
    }
  }

  const candidate = extractJsonCandidate(rawText)

  if (!candidate) {
    return {
      kind: 'failed',
      failure: failed('malformed_json', 'Provider output did not contain JSON.'),
    }
  }

  try {
    const parsed = JSON.parse(candidate) as unknown

    return isRecord(parsed)
      ? { kind: 'json', value: parsed }
      : {
          kind: 'failed',
          failure: failed('malformed_json', 'Provider output JSON must be an object.'),
        }
  } catch {
    return {
      kind: 'failed',
      failure: failed('malformed_json', 'Provider output was not valid JSON.'),
    }
  }
}

function isOffTaskObject(value: Record<string, unknown>, expectedType: string): boolean {
  const explicitType =
    typeof value.feedback_type === 'string'
      ? value.feedback_type
      : typeof value.task_type === 'string'
        ? value.task_type
        : typeof value.type === 'string'
          ? value.type
          : null

  if (explicitType && explicitType !== expectedType) {
    return true
  }

  return (
    'content' in value && !('band_estimate' in value) && !('short_explanation' in value)
  )
}

function containsUnsafeAdvice(value: unknown): boolean {
  const lowerText = JSON.stringify(value).toLowerCase()
  const unsafePatterns = [
    'share account password',
    'share passwords',
    'login password',
    'ask the teacher for their login',
    'self-harm',
    'ignore the teacher',
    'override the teacher',
  ]

  return unsafePatterns.some((pattern) => lowerText.includes(pattern))
}

function classifySchemaFailure(
  value: Record<string, unknown>,
  expectedType: string,
): FailedAiOutput {
  return isOffTaskObject(value, expectedType)
    ? failed('off_task_output', 'Provider output was for a different task.')
    : failed('schema_invalid', 'Provider output did not match the required schema.')
}

function parseCriteriaValidationError(error: unknown): FailedAiOutput | null {
  if (!(error instanceof CriteriaValidationError)) {
    return null
  }

  return failed(error.code, error.message)
}

function validateExpectedCriterionIds(
  suggestions: z.infer<typeof writingCriterionSuggestionSchema>[],
  expectedCriterionIds: string[],
): FailedAiOutput | null {
  const expectedIds = new Set(expectedCriterionIds)
  const receivedIds = new Set<string>()

  for (const suggestion of suggestions) {
    if (receivedIds.has(suggestion.criterion_id)) {
      return failed(
        'duplicate_criteria',
        `Provider duplicated criterion ID: ${suggestion.criterion_id}.`,
      )
    }
    if (!expectedIds.has(suggestion.criterion_id)) {
      return failed(
        'unknown_criteria',
        `Provider returned unknown criterion ID: ${suggestion.criterion_id}.`,
      )
    }
    receivedIds.add(suggestion.criterion_id)
  }

  const missingIds = [...expectedIds].filter((id) => !receivedIds.has(id))
  if (missingIds.length > 0) {
    return failed(
      'missing_criteria',
      `Provider omitted criterion IDs: ${missingIds.join(', ')}.`,
    )
  }

  return null
}

export function parseWritingFeedbackOutput(
  rawText: string,
  options: WritingParseOptions,
): ParsedWritingFeedbackOutput {
  const parsed = parseJsonObject(rawText)

  if (parsed.kind === 'failed') {
    return parsed.failure
  }

  const schemaResult = writingFeedbackSchema.safeParse(parsed.value)
  if (!schemaResult.success) {
    return classifySchemaFailure(parsed.value, 'writing_feedback')
  }

  if (schemaResult.data.safety_flags.unsafe || containsUnsafeAdvice(schemaResult.data)) {
    return failed('unsafe_output', 'Provider output contained unsafe advice.')
  }

  if (options.writingTask) {
    try {
      const normalized = normalizeIeltsWritingCriterionSuggestions(
        options.writingTask,
        schemaResult.data.criterion_band_suggestions.map((suggestion) => ({
          criterionId: suggestion.criterion_id,
          band: suggestion.band,
          rationale: suggestion.rationale,
        })),
      )

      return {
        status: 'accepted',
        feedback: schemaResult.data,
        criteriaVersion: normalized.criteriaVersion,
        normalizedCriterionSuggestions: normalized.suggestions,
        safetyFlags: schemaResult.data.safety_flags,
      }
    } catch (error) {
      const failure = parseCriteriaValidationError(error)
      if (failure) {
        return failure
      }
      throw error
    }
  }

  const criteriaFailure = validateExpectedCriterionIds(
    schemaResult.data.criterion_band_suggestions,
    options.expectedCriterionIds ?? [],
  )
  if (criteriaFailure) {
    return criteriaFailure
  }

  const normalizedCriterionSuggestions =
    schemaResult.data.criterion_band_suggestions.map((suggestion) => ({
      criterionId: suggestion.criterion_id,
      band: suggestion.band,
      rationale: suggestion.rationale,
    }))

  return {
    status: 'accepted',
    feedback: schemaResult.data,
    normalizedCriterionSuggestions,
    safetyFlags: schemaResult.data.safety_flags,
  }
}

export function parseObjectiveExplanationOutput(
  rawText: string,
  options: ObjectiveParseOptions,
): ParsedObjectiveExplanationOutput {
  const parsed = parseJsonObject(rawText)

  if (parsed.kind === 'failed') {
    return parsed.failure
  }

  const schemaResult = objectiveExplanationSchema.safeParse(parsed.value)
  if (!schemaResult.success) {
    return classifySchemaFailure(parsed.value, 'objective_explanation')
  }

  if (containsUnsafeAdvice(schemaResult.data)) {
    return failed('unsafe_output', 'Provider output contained unsafe advice.')
  }

  if (schemaResult.data.result !== options.deterministicResult) {
    return failed(
      'score_override_attempt',
      'Provider output tried to override deterministic scoring.',
    )
  }

  return {
    status: 'completed',
    explanation: schemaResult.data,
  }
}
