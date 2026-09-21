/**
 * File: modules/assignments/assignments.student-content.ts
 * Purpose: Remove objective answer keys and private listening transcripts from learner reads.
 * Why: List and detail responses must not expose authoring data before an attempt.
 */
import { filterWritingAssignmentForStudent } from './assignments.helpers.js'

// These are the answer representations consumed by the objective scorer, including
// grouped questions, matching items, and diagram labels. Keep public prompts/options.
const privateObjectiveKeys = new Set([
  'transcript',
  'answer',
  'answers',
  'correctAnswer',
  'correctAnswers',
  'answerKey',
  'matchId',
  'answerParagraph',
  'answerHeadingId',
  'answerFeatureId',
  'answerId',
])

function withoutObjectiveKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutObjectiveKeys)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !privateObjectiveKeys.has(key))
      .map(([key, item]) => [key, withoutObjectiveKeys(item)]),
  )
}

export function assignmentForStudent<
  T extends {
    type: string
    assignmentConfig: unknown
    submissions?: Array<{
      id: string
      status: string
      grade?: { gradedAt: Date | null } | null
    }>
  },
>(assignment: T): Omit<T, 'submissions'> {
  // Writing has explicit immediate/submission/grading/date-based sample release.
  // Objective answer visibility remains in the separately authorized score/explanation
  // flow; never mutate the stored config used by scoring or teacher authoring.
  if (assignment.type === 'writing') return filterWritingAssignmentForStudent(assignment)
  const { submissions: ignoredSubmissions, ...result } = assignment
  if (assignment.type !== 'listening' && assignment.type !== 'reading') return result
  return {
    ...result,
    assignmentConfig: withoutObjectiveKeys(assignment.assignmentConfig),
  }
}
