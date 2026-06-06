/**
 * File: src/modules/ai-feedback/criteria/criteria.prompt.ts
 * Purpose: Build prompt-safe criteria payloads and system guardrails.
 * Why: Provider prompts should receive canonical IDs and rules, not free-form criteria.
 */
import type {
  IeltsWritingCriteriaPromptCriterion,
  IeltsWritingCriteriaPromptPack,
  IeltsWritingCriteriaScope,
} from './criteria.types.js'
import {
  IELTS_WRITING_CRITERIA,
  IELTS_WRITING_CRITERIA_VERSION,
  IELTS_WRITING_TASK_WEIGHTS,
} from './ieltsWritingCriteria.js'

function getPromptCriteriaForScope(scope: IeltsWritingCriteriaScope) {
  if (scope !== 'combined') {
    return [...IELTS_WRITING_CRITERIA]
      .filter((criterion) => criterion.appliesTo.includes(scope))
      .sort((left, right) => left.order - right.order)
  }

  const combinedIds = [
    'task_achievement',
    'task_response',
    'coherence_cohesion',
    'lexical_resource',
    'grammatical_range_accuracy',
  ]

  return combinedIds.map((id) => {
    const criterion = IELTS_WRITING_CRITERIA.find((candidate) => candidate.id === id)
    if (!criterion) {
      throw new Error(`Missing IELTS writing criterion: ${id}`)
    }
    return criterion
  })
}

function resolvePromptCriterionScope(
  scope: IeltsWritingCriteriaScope,
  criterionAppliesTo: readonly IeltsWritingCriteriaScope[],
): IeltsWritingCriteriaScope {
  if (scope !== 'combined') {
    return scope
  }

  if (criterionAppliesTo.length > 1) {
    return 'combined'
  }

  const firstScope = criterionAppliesTo[0]
  if (!firstScope) {
    throw new Error('IELTS writing criterion must apply to at least one scope.')
  }

  return firstScope
}

export function buildIeltsWritingCriteriaPromptPack(
  scope: IeltsWritingCriteriaScope,
): IeltsWritingCriteriaPromptPack {
  const criteria = getPromptCriteriaForScope(scope)
  const promptCriteria: IeltsWritingCriteriaPromptCriterion[] = criteria.map(
    (criterion) => ({
      criterion_id: criterion.id,
      label: criterion.label,
      task: resolvePromptCriterionScope(scope, criterion.appliesTo),
      order: criterion.order,
      weight: criterion.weight,
      description: criterion.promptDescription,
    }),
  )

  return {
    criteriaVersion: IELTS_WRITING_CRITERIA_VERSION,
    scope,
    expectedCriterionIds: promptCriteria.map((criterion) => criterion.criterion_id),
    criteria: promptCriteria,
    ...(scope === 'combined' ? { taskWeights: IELTS_WRITING_TASK_WEIGHTS } : {}),
    guardrails: [
      'Use only these criterion_id values.',
      'Preserve the provided ordering and weighting.',
      'Do not invent descriptors, rename criteria, merge criteria, or omit criteria.',
      'If evidence is insufficient, flag uncertainty instead of filling gaps.',
      'Treat criterion bands and rationales as advisory; teacher-final grades remain authoritative.',
    ].join(' '),
  }
}

export function buildIeltsWritingCriteriaSystemPromptFragment(): string {
  return [
    `Criteria version: ${IELTS_WRITING_CRITERIA_VERSION}`,
    'Criteria rule: Use only these criterion_id values from the user criteria_pack.',
    'Preserve the supplied criteria ordering and weighting.',
    'Do not invent descriptors, rename criteria, merge criteria, omit criteria, or change weights.',
    'Flag uncertainty when evidence is insufficient instead of filling gaps.',
  ].join('\n')
}
