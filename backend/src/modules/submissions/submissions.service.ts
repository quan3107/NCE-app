/**
 * File: src/modules/submissions/submissions.service.ts
 * Purpose: Implement submission workflows with Prisma-backed persistence.
 * Why: Keeps submission domain code organized and testable.
 */
import { Prisma } from '../../prisma/index.js'

import { logger } from '../../config/logger.js'
import { prisma } from '../../prisma/client.js'
import { SubmissionStatus, UserRole, UserStatus } from '../../prisma/index.js'
import { createHttpError, createNotFoundError } from '../../utils/httpError.js'
import { semanticValuesEqual } from '../../utils/semanticValue.js'
import {
  assignmentScopedParamsSchema,
  DEFAULT_SUBMISSION_LIMIT,
  submissionIdParamsSchema,
  submissionQuerySchema,
  type CreateSubmissionPayload,
} from './submissions.schema.js'
import {
  isIeltsAssignmentType,
  parseSubmissionPayloadForType,
} from '../assignments/ielts.schema.js'
import { autoScoreSubmission } from '../scoring/ieltsScoring.service.js'
import { enqueueAiWritingFeedbackForSubmission } from '../ai-feedback/ai-feedback.service.js'
import { notifyTeachersAboutSubmittedWork } from './submissions.notifications.js'
import { writeAuditLogSafely } from '../audit-logs/audit-logs.service.js'
import {
  applyAssignmentSubmissionPolicy,
  assertAssignmentPublishedForSubmission,
  assertStudentEnrolledForSubmission,
} from './submissions.eligibility.js'
import { applyIeltsTimingRules, parseSubmittedAt } from './submissions.timing.js'
import { assertSubmittedIeltsPayloadHasContent } from './submissions.ielts-content.js'
import { persistSubmission } from './submissions.persistence.js'
import { getOwnedCompletedSubmissionFiles } from '../files/files.service.js'
import { collectionPage, collectionPageQuerySchema } from '../../utils/collectionPage.js'
import { courseAssignmentAccessWhere } from '../courses/courses.shared.js'
import type { CourseManager } from '../courses/courses.types.js'

type SubmissionAssignmentForAiFeedback = {
  type: string
  assignmentConfig: unknown
}

function serializeSubmittedAt(value: Date | string | null | undefined) {
  if (!value) {
    return null
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  return value
}

async function writeSubmissionAuditLog(input: {
  actorId: string
  action: 'submission.created' | 'submission.updated' | 'submission.submitted'
  assignmentId: string
  courseId: string
  studentId: string
  submissionId: string
  statusBefore: SubmissionStatus | null
  statusAfter: SubmissionStatus
  submittedAtBefore?: Date | string | null
  submittedAtAfter?: Date | string | null
  payloadBefore?: unknown
  payloadAfter: unknown
}) {
  const submittedAtChanged =
    serializeSubmittedAt(input.submittedAtBefore) !==
    serializeSubmittedAt(input.submittedAtAfter)
  const submissionContentChanged = !semanticValuesEqual(
    input.payloadBefore,
    input.payloadAfter,
  )
  if (
    input.action === 'submission.updated' &&
    input.statusBefore === input.statusAfter &&
    !submittedAtChanged &&
    !submissionContentChanged
  ) {
    return
  }

  await writeAuditLogSafely({
    actorId: input.actorId,
    action: input.action,
    entity: 'submission',
    entityId: input.submissionId,
    eventData: {
      assignmentId: input.assignmentId,
      courseId: input.courseId,
      studentId: input.studentId,
      statusBefore: input.statusBefore,
      statusAfter: input.statusAfter,
      submittedAtChanged,
      submissionContentChanged,
    },
  })
}

function shouldEnqueueWritingFeedback(
  assignment: SubmissionAssignmentForAiFeedback,
  status: string,
): boolean {
  if (assignment.type !== 'writing' || (status !== 'submitted' && status !== 'late')) {
    return false
  }

  const config =
    assignment.assignmentConfig &&
    typeof assignment.assignmentConfig === 'object' &&
    !Array.isArray(assignment.assignmentConfig)
      ? (assignment.assignmentConfig as Record<string, unknown>)
      : {}
  const aiPolicy =
    config.aiPolicy &&
    typeof config.aiPolicy === 'object' &&
    !Array.isArray(config.aiPolicy)
      ? (config.aiPolicy as Record<string, unknown>)
      : {}

  return (
    aiPolicy.writingFeedbackMode === 'teacher_reviewed' ||
    aiPolicy.writingFeedbackMode === 'instant_student_visible'
  )
}

async function enqueueWritingFeedbackAfterSubmission(input: {
  assignment: SubmissionAssignmentForAiFeedback
  status: string
  studentId: string
  submissionId: string
}): Promise<void> {
  if (!shouldEnqueueWritingFeedback(input.assignment, input.status)) {
    return
  }

  try {
    await enqueueAiWritingFeedbackForSubmission(input.submissionId, {
      id: input.studentId,
      role: UserRole.student,
      status: UserStatus.active,
    })
  } catch (error) {
    logger.warn(
      { err: error, submissionId: input.submissionId },
      'AI writing feedback auto-enqueue failed',
    )
  }
}

export async function listSubmissions(
  params: unknown,
  query: unknown,
  user?: { id: string; role: string },
) {
  const { assignmentId } = assignmentScopedParamsSchema.parse(params)
  const { limit: rawLimit, offset: rawOffset } = submissionQuerySchema.parse(query)
  const limit = rawLimit ?? DEFAULT_SUBMISSION_LIMIT
  const offset = rawOffset ?? 0
  const isStudent = user?.role === 'student'
  return prisma.submission.findMany({
    where: {
      assignmentId,
      deletedAt: null,
      assignment: {
        course: {
          deletedAt: null,
        },
      },
      ...(isStudent ? { studentId: user?.id } : {}),
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit,
    skip: offset,
  })
}

export async function listAccessibleSubmissions(query: unknown, actor: CourseManager) {
  const { cursor, limit } = collectionPageQuerySchema.parse(query)
  const isStudent = actor.role === UserRole.student
  const submissions = await prisma.submission.findMany({
    where: {
      deletedAt: null,
      ...(isStudent ? { studentId: actor.id } : {}),
      assignment: {
        deletedAt: null,
        ...(isStudent ? { publishedAt: { not: null } } : {}),
        course: courseAssignmentAccessWhere(actor, 'read'),
      },
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  })
  return collectionPage(submissions, limit)
}

export async function createSubmission(
  params: unknown,
  payload: CreateSubmissionPayload,
  user?: { id: string; role: string },
) {
  const { assignmentId } = assignmentScopedParamsSchema.parse(params)
  const requestedSubmittedAt = parseSubmittedAt(payload.submittedAt)
  let status = payload.status ?? (requestedSubmittedAt ? 'submitted' : 'draft')
  let submittedAt = status === 'draft' ? requestedSubmittedAt : new Date()
  if (!user || user.role !== 'student') {
    throw createHttpError(403, 'Only students can submit assignments.')
  }

  const assignment = await prisma.assignment.findFirst({
    where: {
      id: assignmentId,
      deletedAt: null,
      course: {
        deletedAt: null,
      },
    },
    select: {
      id: true,
      courseId: true,
      title: true,
      type: true,
      assignmentConfig: true,
      dueAt: true,
      latePolicy: true,
      publishedAt: true,
      course: {
        select: {
          title: true,
        },
      },
    },
  })

  if (!assignment) {
    throw createNotFoundError('Assignment', assignmentId)
  }

  assertAssignmentPublishedForSubmission(assignment)
  await assertStudentEnrolledForSubmission(assignment, user.id)

  const parsedPayload = parseSubmissionPayloadForType(assignment.type, payload.payload)
  const parsedFilePayload = parsedPayload as { files: Array<{ id: string }> }
  const validatedPayload =
    assignment.type === 'file'
      ? {
          ...parsedFilePayload,
          files: await getOwnedCompletedSubmissionFiles(
            parsedFilePayload.files.map((file) => file.id),
            user.id,
            UserRole.student,
          ),
        }
      : parsedPayload

  const isIeltsAssignment = isIeltsAssignmentType(assignment.type)
  ;({ status, submittedAt } = applyIeltsTimingRules({
    assignmentConfig: assignment.assignmentConfig,
    isIeltsAssignment,
    status,
    submittedAt,
    validatedPayload,
  }))
  ;({ status, submittedAt } = applyAssignmentSubmissionPolicy({
    assignment,
    status,
    submittedAt,
  }))

  // Cast validated payloads to Prisma JSON input for storage.
  const payloadJson = validatedPayload as Prisma.InputJsonObject

  assertSubmittedIeltsPayloadHasContent({
    type: assignment.type,
    status,
    payload: validatedPayload,
  })
  const { submission, previous, changed } = await persistSubmission({
    assignment,
    studentId: user.id,
    status,
    payload: payloadJson,
  })
  if (changed)
    await writeSubmissionAuditLog({
      actorId: user.id,
      action: previous
        ? previous.status === 'draft' && submission.status !== 'draft'
          ? 'submission.submitted'
          : 'submission.updated'
        : 'submission.created',
      assignmentId,
      courseId: assignment.courseId,
      studentId: user.id,
      submissionId: submission.id,
      statusBefore: previous?.status ?? null,
      statusAfter: submission.status,
      submittedAtBefore: previous?.submittedAt,
      submittedAtAfter: submission.submittedAt,
      payloadBefore: previous?.payload,
      payloadAfter: submission.payload,
    })
  if (
    submission.status !== 'draft' &&
    (assignment.type === 'reading' || assignment.type === 'listening')
  ) {
    await autoScoreSubmission(submission.id)
  }
  await enqueueWritingFeedbackAfterSubmission({
    assignment,
    status: submission.status === 'graded' ? 'submitted' : submission.status,
    studentId: user.id,
    submissionId: submission.id,
  })
  await notifyTeachersAboutSubmittedWork({
    assignment,
    studentId: user.id,
    submission,
    status: submission.status === 'graded' ? 'submitted' : submission.status,
  })
  return submission
}

export async function getSubmissionById(params: unknown) {
  const { submissionId } = submissionIdParamsSchema.parse(params)
  const submission = await prisma.submission.findFirst({
    where: { id: submissionId, deletedAt: null },
  })
  if (!submission) {
    throw createNotFoundError('Submission', submissionId)
  }
  return submission
}

/**
 * Get count of ungraded submissions for a teacher/admin.
 * Ungraded = submitted or late status, no grade exists.
 */
export async function getUngradedSubmissionsCount(teacherId: string): Promise<number> {
  const count = await prisma.submission.count({
    where: {
      deletedAt: null,
      status: { in: ['submitted', 'late'] },
      OR: [{ grade: null }, { grade: { deletedAt: { not: null } } }],
      assignment: {
        course: {
          ownerId: teacherId,
          deletedAt: null,
        },
      },
    },
  })

  return count
}
