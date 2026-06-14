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
import type {
  IeltsWritingCriteriaScope,
  IeltsWritingTask,
} from './criteria/criteria.types.js'

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
    | 'invented_weighting'
    | 'unsafe_output'
    | 'off_task_output'
    | 'score_override_attempt'
    | 'unsupported_evidence'
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
  writingScope?: IeltsWritingCriteriaScope
  writingTask?: IeltsWritingTask
}

type ObjectiveParseOptions = {
  deterministicResult: string
  sourceContextText?: string
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
  let explicitType: string | null = null

  if (typeof value.feedback_type === 'string') {
    explicitType = value.feedback_type
  } else if (typeof value.task_type === 'string') {
    explicitType = value.task_type
  } else if (typeof value.type === 'string') {
    explicitType = value.type
  }

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

function normalizeEvidenceText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function evidenceTextTokens(value: string): string[] {
  return normalizeEvidenceText(value).split(' ').filter(Boolean)
}

const evidenceStopWords = new Set([
  'about',
  'answer',
  'after',
  'because',
  'before',
  'context',
  'evidence',
  'from',
  'passage',
  'question',
  'source',
  'stated',
  'student',
  'that',
  'their',
  'there',
  'this',
  'with',
])

const evidenceEquivalentTokens = new Map([
  ['ris', 'increase'],
  ['increas', 'increase'],
  ['increased', 'increase'],
  ['increase', 'increase'],
  ['switch', 'change'],
  ['chang', 'change'],
  ['changed', 'change'],
  ['change', 'change'],
])

function normalizeEvidenceToken(token: string): string {
  let normalized = token

  if (normalized.length > 5 && normalized.endsWith('ies')) {
    normalized = `${normalized.slice(0, -3)}y`
  } else if (normalized.length > 4 && normalized.endsWith('ing')) {
    normalized = normalized.slice(0, -3)
  } else if (normalized.length > 4 && normalized.endsWith('ed')) {
    normalized = normalized.slice(0, -2)
  } else if (normalized.length > 3 && normalized.endsWith('s')) {
    normalized = normalized.slice(0, -1)
  }

  const equivalentToken = evidenceEquivalentTokens.get(normalized)
  if (equivalentToken) {
    return equivalentToken
  }

  return normalized
}

function evidenceContentTokens(value: string): string[] {
  const tokens = evidenceTextTokens(value)
  const contentTokens = tokens
    .map(normalizeEvidenceToken)
    .filter((token) => token.length > 2)
    .filter((token) => !evidenceStopWords.has(token))

  return Array.from(new Set(contentTokens))
}

function hasContiguousTokenSequence(needle: string[], haystack: string[]): boolean {
  if (needle.length === 0 || needle.length > haystack.length) {
    return false
  }

  for (let start = 0; start <= haystack.length - needle.length; start += 1) {
    const candidate = haystack.slice(start, start + needle.length)
    if (candidate.every((token, index) => token === needle[index])) {
      return true
    }
  }

  return false
}

function sourceSupportsAllEvidenceTokens(
  evidenceTokens: string[],
  sourceTokens: Set<string>,
): boolean {
  if (evidenceTokens.length === 0) {
    return false
  }

  return evidenceTokens.every((token) => sourceTokens.has(token))
}

function sourceContextSpans(sourceContextText: string): string[] {
  return sourceContextText
    .split(/[.!?;\n]+/)
    .map((span) => span.trim())
    .filter(Boolean)
}

function sourceSpanSupportsEvidence(evidence: string, sourceSpan: string): boolean {
  const evidenceTokens = evidenceTextTokens(evidence)
  const sourceTokens = evidenceTextTokens(sourceSpan)

  if (hasContiguousTokenSequence(evidenceTokens, sourceTokens)) {
    return true
  }

  const evidenceContent = evidenceContentTokens(evidence)
  const sourceContent = new Set(evidenceContentTokens(sourceSpan))

  return sourceSupportsAllEvidenceTokens(evidenceContent, sourceContent)
}

function hasSupportedEvidence(evidence: string, sourceContextText: string): boolean {
  const normalizedEvidence = normalizeEvidenceText(evidence)
  const normalizedSource = normalizeEvidenceText(sourceContextText)

  if (!normalizedEvidence || !normalizedSource) {
    return false
  }

  const sourceSpans = sourceContextSpans(sourceContextText)

  return sourceSpans.some((sourceSpan) => sourceSpanSupportsEvidence(evidence, sourceSpan))
}

function containsInventedWeighting(value: Record<string, unknown>): boolean {
  if ('criteria_weights' in value || 'criterion_weights' in value || 'task_weights' in value) {
    return true
  }

  const suggestions = value.criterion_band_suggestions
  if (!Array.isArray(suggestions)) {
    return false
  }

  return suggestions.some(
    (suggestion) =>
      isRecord(suggestion) &&
      ('weight' in suggestion ||
        'weights' in suggestion ||
        'criterion_weight' in suggestion ||
        'task_weight' in suggestion),
  )
}

function classifySchemaFailure(
  value: Record<string, unknown>,
  expectedType: string,
): FailedAiOutput {
  if (isOffTaskObject(value, expectedType)) {
    return failed('off_task_output', 'Provider output was for a different task.')
  }

  return failed('schema_invalid', 'Provider output did not match the required schema.')
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

  if (containsInventedWeighting(parsed.value)) {
    return failed(
      'invented_weighting',
      'Provider output tried to invent or override criteria weighting.',
    )
  }

  const schemaResult = writingFeedbackSchema.safeParse(parsed.value)
  if (!schemaResult.success) {
    return classifySchemaFailure(parsed.value, 'writing_feedback')
  }

  if (schemaResult.data.safety_flags.unsafe || containsUnsafeAdvice(schemaResult.data)) {
    return failed('unsafe_output', 'Provider output contained unsafe advice.')
  }

  const writingScope = options.writingScope ?? options.writingTask

  if (writingScope) {
    try {
      const normalized = normalizeIeltsWritingCriterionSuggestions(
        writingScope,
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

  const normalizedCriterionSuggestions = schemaResult.data.criterion_band_suggestions.map(
    (suggestion) => ({
      criterionId: suggestion.criterion_id,
      band: suggestion.band,
      rationale: suggestion.rationale,
    }),
  )

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

  if (
    options.sourceContextText &&
    !hasSupportedEvidence(schemaResult.data.evidence, options.sourceContextText)
  ) {
    return failed(
      'unsupported_evidence',
      'Provider output cited evidence that was not found in the source context.',
    )
  }

  return {
    status: 'completed',
    explanation: schemaResult.data,
  }
}
