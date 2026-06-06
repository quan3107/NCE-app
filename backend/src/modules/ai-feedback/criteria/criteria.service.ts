/**
 * File: src/modules/ai-feedback/criteria/criteria.service.ts
 * Purpose: Resolve and validate canonical IELTS writing criteria for AI feedback.
 * Why: The server must own criteria identity, band validity, and aggregation rules.
 */
import {
  IELTS_WRITING_CRITERIA,
  IELTS_WRITING_CRITERIA_VERSION,
  IELTS_WRITING_TASK_WEIGHTS,
} from './ieltsWritingCriteria.js'
import { buildIeltsWritingCriteriaPromptPack } from './criteria.prompt.js'
import type {
  IeltsWritingCriteriaScope,
  IeltsWritingCriterion,
  IeltsWritingCriterionId,
  IeltsWritingCriterionSuggestion,
  IeltsWritingTask,
  NormalizedIeltsWritingCriterionSuggestion,
} from './criteria.types.js'

const IELTS_MIN_BAND = 0
const IELTS_MAX_BAND = 9
const HALF_STEP = 0.5
const EPSILON = 0.00001

export {
  IELTS_WRITING_CRITERIA_VERSION,
  buildIeltsWritingCriteriaPromptPack,
}

export type CriteriaValidationCode =
  | 'duplicate_criteria'
  | 'missing_criteria'
  | 'unknown_criteria'
  | 'wrong_task_criteria'
  | 'invalid_criteria_band'

export class CriteriaValidationError extends Error {
  constructor(
    readonly code: CriteriaValidationCode,
    message: string,
  ) {
    super(message)
    this.name = 'CriteriaValidationError'
  }
}

function sortCriteria(criteria: readonly IeltsWritingCriterion[]): IeltsWritingCriterion[] {
  return [...criteria].sort((left, right) => left.order - right.order)
}

function normalizeLookupValue(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
}

function isCriterionApplicableToScope(
  criterion: IeltsWritingCriterion,
  scope: IeltsWritingCriteriaScope,
): boolean {
  return scope === 'combined' || criterion.appliesTo.includes(scope)
}

function getCriterionById(id: string): IeltsWritingCriterion | undefined {
  return IELTS_WRITING_CRITERIA.find((criterion) => criterion.id === id)
}

function getExpectedCriterionIds(
  task: IeltsWritingTask,
): IeltsWritingCriterionId[] {
  return getIeltsWritingCriteriaForTask(task).map((criterion) => criterion.id)
}

function assertValidBand(value: number): void {
  if (!isValidIeltsWritingBand(value)) {
    throw new CriteriaValidationError(
      'invalid_criteria_band',
      'IELTS writing criterion bands must use valid 0.5 increments from 0 to 9.',
    )
  }
}

export function isValidIeltsWritingBand(value: number): boolean {
  if (!Number.isFinite(value)) {
    return false
  }
  if (value < IELTS_MIN_BAND || value > IELTS_MAX_BAND) {
    return false
  }
  return Math.abs(value / HALF_STEP - Math.round(value / HALF_STEP)) < EPSILON
}

export function roundIeltsWritingBand(value: number): number {
  const rounded = Math.round(value / HALF_STEP) * HALF_STEP
  return Math.min(IELTS_MAX_BAND, Math.max(IELTS_MIN_BAND, rounded))
}

export function getIeltsWritingCriteriaForTask(
  task: IeltsWritingTask,
): IeltsWritingCriterion[] {
  return sortCriteria(
    IELTS_WRITING_CRITERIA.filter((criterion) =>
      isCriterionApplicableToScope(criterion, task),
    ),
  )
}

export function getIeltsWritingCriteriaForScope(
  scope: IeltsWritingCriteriaScope,
): IeltsWritingCriterion[] {
  if (scope !== 'combined') {
    return getIeltsWritingCriteriaForTask(scope)
  }

  const combinedIds: IeltsWritingCriterionId[] = [
    'task_achievement',
    'task_response',
    'coherence_cohesion',
    'lexical_resource',
    'grammatical_range_accuracy',
  ]

  return combinedIds.map((id) => {
    const criterion = getCriterionById(id)
    if (!criterion) {
      throw new Error(`Missing IELTS writing criterion: ${id}`)
    }
    return criterion
  })
}

export function resolveIeltsWritingCriterionId(
  value: string,
  task?: IeltsWritingTask,
): IeltsWritingCriterionId | null {
  const normalized = normalizeLookupValue(value)
  const criterion = IELTS_WRITING_CRITERIA.find(
    (candidate) =>
      normalizeLookupValue(candidate.id) === normalized ||
      normalizeLookupValue(candidate.label) === normalized ||
      candidate.aliases.some((alias) => normalizeLookupValue(alias) === normalized),
  )

  if (!criterion) {
    return null
  }

  if (task && !isCriterionApplicableToScope(criterion, task)) {
    return null
  }

  return criterion.id
}

export function normalizeIeltsWritingCriterionSuggestions(
  scope: IeltsWritingCriteriaScope,
  suggestions: IeltsWritingCriterionSuggestion[],
): {
  criteriaVersion: typeof IELTS_WRITING_CRITERIA_VERSION
  suggestions: NormalizedIeltsWritingCriterionSuggestion[]
} {
  const expectedIds =
    scope === 'combined'
      ? getIeltsWritingCriteriaForScope(scope).map((criterion) => criterion.id)
      : getExpectedCriterionIds(scope)
  const seenIds = new Set<IeltsWritingCriterionId>()
  const normalizedSuggestions: NormalizedIeltsWritingCriterionSuggestion[] = []

  for (const suggestion of suggestions) {
    const criterion = getCriterionById(suggestion.criterionId)

    if (!criterion) {
      throw new CriteriaValidationError(
        'unknown_criteria',
        `IELTS writing criterion is unknown: ${suggestion.criterionId}.`,
      )
    }

    if (!isCriterionApplicableToScope(criterion, scope)) {
      throw new CriteriaValidationError(
        'wrong_task_criteria',
        `Criterion ${suggestion.criterionId} is not valid for IELTS writing ${scope}.`,
      )
    }

    if (seenIds.has(criterion.id)) {
      throw new CriteriaValidationError(
        'duplicate_criteria',
        'IELTS writing criteria must not be duplicated.',
      )
    }

    assertValidBand(suggestion.band)
    seenIds.add(criterion.id)
    normalizedSuggestions.push({
      criterionId: criterion.id,
      band: suggestion.band,
      rationale: suggestion.rationale.trim(),
    })
  }

  const missingIds = expectedIds.filter((id) => !seenIds.has(id))
  if (missingIds.length > 0) {
    throw new CriteriaValidationError(
      'missing_criteria',
      `Provider omitted IELTS writing criterion IDs: ${missingIds.join(', ')}.`,
    )
  }

  return {
    criteriaVersion: IELTS_WRITING_CRITERIA_VERSION,
    suggestions: expectedIds.map((id) => {
      const suggestion = normalizedSuggestions.find((item) => item.criterionId === id)
      if (!suggestion) {
        throw new Error(`Missing normalized IELTS writing criterion: ${id}`)
      }
      return suggestion
    }),
  }
}

export function calculateIeltsWritingTaskBand(
  suggestions: NormalizedIeltsWritingCriterionSuggestion[],
): number {
  if (suggestions.length === 0) {
    return 0
  }

  const total = suggestions.reduce((sum, suggestion) => sum + suggestion.band, 0)
  return roundIeltsWritingBand(total / suggestions.length)
}

export function calculateCombinedIeltsWritingBand(input: {
  task1Band: number
  task2Band: number
}): number {
  assertValidBand(input.task1Band)
  assertValidBand(input.task2Band)

  return roundIeltsWritingBand(
    input.task1Band * IELTS_WRITING_TASK_WEIGHTS.task1 +
      input.task2Band * IELTS_WRITING_TASK_WEIGHTS.task2,
  )
}
