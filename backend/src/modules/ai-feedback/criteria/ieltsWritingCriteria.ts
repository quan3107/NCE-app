/**
 * File: src/modules/ai-feedback/criteria/ieltsWritingCriteria.ts
 * Purpose: Store the first-release IELTS writing criteria source of truth.
 * Why: AI feedback must use app-owned IDs, labels, ordering, and safe descriptors.
 */
import type { IeltsWritingCriterion } from './criteria.types.js'

export const IELTS_WRITING_CRITERIA_VERSION = 'ielts-writing-criteria-v1'

export const IELTS_WRITING_TASK_WEIGHTS = {
  task1: 1 / 3,
  task2: 2 / 3,
} as const

export const IELTS_WRITING_CRITERIA: readonly IeltsWritingCriterion[] = [
  {
    id: 'task_achievement',
    label: 'Task Achievement',
    aliases: ['ta', 'task achievement'],
    appliesTo: ['task1'],
    order: 10,
    weight: 0.25,
    promptDescription:
      'Assess Task 1 coverage, overview, key features, and relevant detail without inventing visual evidence.',
  },
  {
    id: 'task_response',
    label: 'Task Response',
    aliases: ['tr', 'task response'],
    appliesTo: ['task2'],
    order: 10,
    weight: 0.25,
    promptDescription:
      'Assess Task 2 position, idea development, relevance, and support without overriding teacher judgment.',
  },
  {
    id: 'coherence_cohesion',
    label: 'Coherence and Cohesion',
    aliases: ['cc', 'coherence and cohesion', 'coherence cohesion'],
    appliesTo: ['task1', 'task2'],
    order: 20,
    weight: 0.25,
    promptDescription:
      'Assess organization, paragraphing, progression, referencing, and linking at a high level.',
  },
  {
    id: 'lexical_resource',
    label: 'Lexical Resource',
    aliases: ['lr', 'lexical resource', 'vocabulary'],
    appliesTo: ['task1', 'task2'],
    order: 30,
    weight: 0.25,
    promptDescription:
      'Assess range, precision, collocation, word formation, and spelling at a high level.',
  },
  {
    id: 'grammatical_range_accuracy',
    label: 'Grammatical Range and Accuracy',
    aliases: [
      'gra',
      'grammatical range and accuracy',
      'grammar',
      'grammatical range accuracy',
    ],
    appliesTo: ['task1', 'task2'],
    order: 40,
    weight: 0.25,
    promptDescription:
      'Assess sentence range, control, punctuation, and error impact at a high level.',
  },
]

