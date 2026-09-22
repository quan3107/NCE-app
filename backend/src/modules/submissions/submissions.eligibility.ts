/**
 * File: src/modules/submissions/submissions.eligibility.ts
 * Purpose: Enforce assignment availability, enrollment, and late-policy rules.
 * Why: Keeps submission persistence separate from course and deadline eligibility.
 */
import { prisma } from '../../prisma/client.js'
import { createHttpError } from '../../utils/httpError.js'
import type { SubmissionStatus } from './submissions.timing.js'

export type SubmissionEligibilityErrorCode =
  | 'submission_unpublished'
  | 'submission_unenrolled'
  | 'submission_closed'
  | 'submission_late_disallowed'
  | 'submission_graded'
  | 'submission_invalid_draft_transition'

type AssignmentEligibilityFields = {
  courseId: string
  dueAt: Date | null
  latePolicy: unknown
  publishedAt: Date | null
}

function createSubmissionEligibilityError(
  statusCode: number,
  message: string,
  code: SubmissionEligibilityErrorCode,
) {
  return createHttpError(statusCode, message, { code })
}

export const SUBMISSION_GRACE_MS = 24 * 60 * 60 * 1000

export function assertAssignmentPublishedForSubmission(
  assignment: AssignmentEligibilityFields,
) {
  if (!assignment.publishedAt) {
    throw createSubmissionEligibilityError(
      403,
      'This assignment is not open for submissions.',
      'submission_unpublished',
    )
  }
}

export async function assertStudentEnrolledForSubmission(
  assignment: AssignmentEligibilityFields,
  studentId: string,
) {
  const enrollment = await prisma.enrollment.findFirst({
    where: {
      courseId: assignment.courseId,
      userId: studentId,
      roleInCourse: 'student',
      deletedAt: null,
    },
    select: { id: true },
  })

  if (!enrollment) {
    throw createSubmissionEligibilityError(
      403,
      'You must be enrolled in this course to submit work.',
      'submission_unenrolled',
    )
  }
}

export function applyAssignmentSubmissionPolicy(input: {
  assignment: AssignmentEligibilityFields
  status: SubmissionStatus
  submittedAt: Date | undefined
  now?: Date
}): { status: SubmissionStatus; submittedAt: Date | undefined } {
  const dueAt = input.assignment.dueAt
  const now = input.now ?? new Date()

  // Absolute elapsed hours, independent of daylight-saving/local calendar changes.
  if (dueAt && now.getTime() >= dueAt.getTime() + SUBMISSION_GRACE_MS) {
    throw createSubmissionEligibilityError(
      409,
      'Submissions closed 24 hours after the deadline.',
      'submission_closed',
    )
  }

  if (input.status === 'draft') {
    if (input.submittedAt) {
      throw createSubmissionEligibilityError(
        409,
        'Draft submissions cannot have a submission timestamp.',
        'submission_invalid_draft_transition',
      )
    }
    return { status: 'draft', submittedAt: undefined }
  }

  const effectiveSubmittedAt = now
  if (!dueAt || effectiveSubmittedAt.getTime() <= dueAt.getTime()) {
    return { status: 'submitted', submittedAt: effectiveSubmittedAt }
  }

  return { status: 'late', submittedAt: effectiveSubmittedAt }
}

export function assertExistingSubmissionCanTransition(input: {
  existingStatus: string
  nextStatus: SubmissionStatus
}) {
  if (input.nextStatus === 'draft' && input.existingStatus !== 'draft') {
    throw createSubmissionEligibilityError(
      409,
      'Submitted work cannot be changed back to draft.',
      'submission_invalid_draft_transition',
    )
  }
}
