/**
 * File: src/modules/ai-feedback/criteria/criteria.types.ts
 * Purpose: Define app-owned IELTS writing criteria contracts for AI feedback.
 * Why: Prompts, parsers, and records need one stable criteria vocabulary.
 */
export type IeltsWritingTask = 'task1' | 'task2'
export type IeltsWritingCriteriaScope = IeltsWritingTask | 'combined'

export type IeltsWritingCriterionId =
  | 'task_achievement'
  | 'task_response'
  | 'coherence_cohesion'
  | 'lexical_resource'
  | 'grammatical_range_accuracy'

export type IeltsWritingCriterion = {
  id: IeltsWritingCriterionId
  label: string
  aliases: readonly string[]
  appliesTo: readonly IeltsWritingTask[]
  order: number
  weight: number
  promptDescription: string
}

export type IeltsWritingCriterionSuggestion = {
  criterionId: string
  band: number
  rationale: string
}

export type NormalizedIeltsWritingCriterionSuggestion = {
  criterionId: IeltsWritingCriterionId
  band: number
  rationale: string
}

export type IeltsWritingCriteriaPromptCriterion = {
  criterion_id: IeltsWritingCriterionId
  label: string
  task: IeltsWritingCriteriaScope
  order: number
  weight: number
  description: string
}

export type IeltsWritingCriteriaPromptPack = {
  criteriaVersion: string
  scope: IeltsWritingCriteriaScope
  expectedCriterionIds: IeltsWritingCriterionId[]
  criteria: IeltsWritingCriteriaPromptCriterion[]
  taskWeights?: {
    task1: number
    task2: number
  }
  guardrails: string
}
