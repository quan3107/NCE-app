/** Exact instant tests supplement the real PostgreSQL/API acceptance suite. */
import { describe, it, expect } from 'vitest'
import {
  applyAssignmentSubmissionPolicy,
  assertExistingSubmissionCanTransition,
} from '../../../src/modules/submissions/submissions.eligibility.js'

describe('absolute submission deadline boundaries', () => {
  const dueAt = new Date('2026-11-01T01:30:00-04:00')
  const assignment = {
    courseId: 'course',
    publishedAt: new Date(),
    dueAt,
    latePolicy: { type: 'closed' },
  }
  const check = (offset: number, status: 'draft' | 'submitted' = 'submitted') =>
    applyAssignmentSubmissionPolicy({
      assignment,
      status,
      submittedAt: undefined,
      now: new Date(dueAt.getTime() + offset),
    })
  it('is on time exactly at dueAt and late one millisecond later, independent of historical policy', () => {
    expect(check(0).status).toBe('submitted')
    expect(check(1).status).toBe('late')
    expect(check(86_399_999).status).toBe('late')
  })
  it('closes exactly 24 elapsed hours later, even across a DST boundary', () => {
    for (const status of ['draft', 'submitted'] as const) {
      expect(() => check(86_400_000, status)).toThrow('Submissions closed')
      expect(() => check(86_400_001, status)).toThrow('Submissions closed')
    }
  })
  it('permits drafts during the grace period and graded replacement, but not submitted-to-draft regression', () => {
    expect(check(1, 'draft').status).toBe('draft')
    expect(() =>
      assertExistingSubmissionCanTransition({
        existingStatus: 'graded',
        nextStatus: 'late',
      }),
    ).not.toThrow()
    expect(() =>
      assertExistingSubmissionCanTransition({
        existingStatus: 'submitted',
        nextStatus: 'draft',
      }),
    ).toThrow('back to draft')
  })
})
