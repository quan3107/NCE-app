/**
 * File: tests/modules/ai-feedback/criteria/ieltsWritingCriteria.test.ts
 * Purpose: Verify the canonical IELTS writing criteria contract used by AI feedback.
 * Why: AI output must be constrained by app-owned criteria, bands, and weighting rules.
 */
import { describe, expect, it } from 'vitest'

import {
  IELTS_WRITING_CRITERIA_VERSION,
  buildIeltsWritingCriteriaPromptPack,
  calculateCombinedIeltsWritingBand,
  calculateIeltsWritingTaskBand,
  getIeltsWritingCriteriaForTask,
  normalizeIeltsWritingCriterionSuggestions,
  resolveIeltsWritingCriterionId,
} from '../../../../src/modules/ai-feedback/criteria/criteria.service.js'

describe('IELTS writing criteria contract', () => {
  it('returns ordered canonical Task 1 and Task 2 criteria from one versioned source', () => {
    expect(IELTS_WRITING_CRITERIA_VERSION).toBe('ielts-writing-criteria-v1')

    expect(
      getIeltsWritingCriteriaForTask('task1').map((criterion) => criterion.id),
    ).toEqual([
      'task_achievement',
      'coherence_cohesion',
      'lexical_resource',
      'grammatical_range_accuracy',
    ])

    expect(
      getIeltsWritingCriteriaForTask('task2').map((criterion) => criterion.id),
    ).toEqual([
      'task_response',
      'coherence_cohesion',
      'lexical_resource',
      'grammatical_range_accuracy',
    ])
  })

  it('resolves documented aliases without allowing wrong-task criteria', () => {
    expect(resolveIeltsWritingCriterionId('Task Achievement', 'task1')).toBe(
      'task_achievement',
    )
    expect(resolveIeltsWritingCriterionId('TR', 'task2')).toBe('task_response')
    expect(resolveIeltsWritingCriterionId('Task Achievement', 'task2')).toBeNull()
    expect(resolveIeltsWritingCriterionId('pronunciation', 'task2')).toBeNull()
  })

  it('builds prompt packs with IDs, weighting, and guardrails but not full descriptor corpus text', () => {
    const pack = buildIeltsWritingCriteriaPromptPack('task2')

    expect(pack.criteriaVersion).toBe(IELTS_WRITING_CRITERIA_VERSION)
    expect(pack.expectedCriterionIds).toEqual([
      'task_response',
      'coherence_cohesion',
      'lexical_resource',
      'grammatical_range_accuracy',
    ])
    expect(pack.guardrails).toContain('Use only these criterion_id values')
    expect(pack.guardrails).toContain('Do not invent descriptors')
    expect(pack.criteria).toContainEqual(
      expect.objectContaining({
        criterion_id: 'task_response',
        weight: 0.25,
      }),
    )
    expect(JSON.stringify(pack)).not.toContain('Band 9')
  })

  it('labels shared criteria with the requested non-combined task scope', () => {
    const pack = buildIeltsWritingCriteriaPromptPack('task2')

    expect(pack.criteria.map((criterion) => criterion.task)).toEqual([
      'task2',
      'task2',
      'task2',
      'task2',
    ])
  })

  it('normalizes valid half-band suggestions and computes task plus combined bands', () => {
    const normalized = normalizeIeltsWritingCriterionSuggestions('task2', [
      { criterionId: 'task_response', band: 6.5, rationale: 'Clear position.' },
      { criterionId: 'coherence_cohesion', band: 7, rationale: 'Logical flow.' },
      { criterionId: 'lexical_resource', band: 7.5, rationale: 'Good range.' },
      {
        criterionId: 'grammatical_range_accuracy',
        band: 7,
        rationale: 'Mostly accurate.',
      },
    ])

    expect(normalized.criteriaVersion).toBe(IELTS_WRITING_CRITERIA_VERSION)
    expect(calculateIeltsWritingTaskBand(normalized.suggestions)).toBe(7)
    expect(calculateCombinedIeltsWritingBand({ task1Band: 5, task2Band: 8 })).toBe(7)
  })

  it('rejects duplicate, missing, wrong-task, and invalid-band suggestions', () => {
    expect(() =>
      normalizeIeltsWritingCriterionSuggestions('task1', [
        { criterionId: 'task_achievement', band: 6.25, rationale: 'Invalid band.' },
        { criterionId: 'coherence_cohesion', band: 7, rationale: 'Ok.' },
        { criterionId: 'lexical_resource', band: 7, rationale: 'Ok.' },
        { criterionId: 'grammatical_range_accuracy', band: 7, rationale: 'Ok.' },
      ]),
    ).toThrow(/valid 0\.5 increments/)

    expect(() =>
      normalizeIeltsWritingCriterionSuggestions('task1', [
        { criterionId: 'task_response', band: 7, rationale: 'Wrong task.' },
        { criterionId: 'coherence_cohesion', band: 7, rationale: 'Ok.' },
        { criterionId: 'lexical_resource', band: 7, rationale: 'Ok.' },
        { criterionId: 'grammatical_range_accuracy', band: 7, rationale: 'Ok.' },
      ]),
    ).toThrow(/not valid for IELTS writing task1/)

    expect(() =>
      normalizeIeltsWritingCriterionSuggestions('task2', [
        { criterionId: 'task_response', band: 7, rationale: 'Ok.' },
        { criterionId: 'task_response', band: 7, rationale: 'Duplicate.' },
        { criterionId: 'lexical_resource', band: 7, rationale: 'Ok.' },
        { criterionId: 'grammatical_range_accuracy', band: 7, rationale: 'Ok.' },
      ]),
    ).toThrow(/must not be duplicated/)
  })
})
