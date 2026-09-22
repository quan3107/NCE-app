/** Persist student work under database locks; preserve replaced content and official grades. */
import { Prisma, type Assignment } from '../../prisma/index.js'
import { prisma } from '../../prisma/client.js'
import { createHttpError, createNotFoundError } from '../../utils/httpError.js'
import { semanticValuesEqual } from '../../utils/semanticValue.js'
import {
  applyAssignmentSubmissionPolicy,
  assertAssignmentPublishedForSubmission,
  assertExistingSubmissionCanTransition,
} from './submissions.eligibility.js'
import type { SubmissionStatus } from './submissions.timing.js'

export async function persistSubmission(input: {
  assignment: Pick<Assignment, 'id' | 'type' | 'assignmentConfig'>
  studentId: string
  status: SubmissionStatus
  payload: Prisma.InputJsonObject
}) {
  return prisma.$transaction(async (tx) => {
    // Also serializes first submissions, where no submission row exists to lock yet.
    await tx.$queryRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${input.assignment.id + ':' + input.studentId}, 0))::text`,
    )
    await tx.$queryRaw(
      Prisma.sql`SELECT id FROM assignments WHERE id = ${input.assignment.id}::uuid FOR SHARE`,
    )
    const assignment = await tx.assignment.findFirst({
      where: {
        id: input.assignment.id,
        deletedAt: null,
        course: { deletedAt: null },
      },
    })
    if (!assignment) throw createNotFoundError('Assignment', input.assignment.id)
    assertAssignmentPublishedForSubmission(assignment)
    if (
      assignment.type !== input.assignment.type ||
      !semanticValuesEqual(assignment.assignmentConfig, input.assignment.assignmentConfig)
    ) {
      throw createHttpError(409, 'Assignment changed. Reload before submitting.')
    }
    const enrollments = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT id FROM enrollments WHERE course_id = ${assignment.courseId}::uuid
      AND user_id = ${input.studentId}::uuid AND role_in_course = 'student'
      AND "deletedAt" IS NULL FOR SHARE`)
    if (!enrollments.length)
      throw createHttpError(403, 'You must be enrolled in this course to submit work.')
    await tx.$queryRaw(Prisma.sql`SELECT id FROM submissions WHERE assignment_id = ${assignment.id}::uuid
      AND student_id = ${input.studentId}::uuid FOR UPDATE`)
    const current = await tx.submission.findUnique({
      where: {
        assignmentId_studentId: {
          assignmentId: assignment.id,
          studentId: input.studentId,
        },
      },
    })
    // Sample the clock after waiting for locks, never using client-supplied time.
    const [{ now }] = await tx.$queryRaw<Array<{ now: Date }>>(
      Prisma.sql`SELECT clock_timestamp() AS now`,
    )
    const { status, submittedAt } = applyAssignmentSubmissionPolicy({
      assignment,
      status: input.status,
      submittedAt: undefined,
      now,
    })
    const payload = { ...input.payload }
    delete payload.version
    if (current) {
      assertExistingSubmissionCanTransition({
        existingStatus: current.status,
        nextStatus: status,
      })
      const previous = { ...(current.payload as Prisma.InputJsonObject) }
      const version = typeof previous.version === 'number' ? previous.version : 1
      delete previous.version
      if (
        !current.deletedAt &&
        semanticValuesEqual(previous, payload) &&
        (current.status === 'draft') === (status === 'draft')
      ) {
        return { submission: current, previous: current, changed: false }
      }
      const grade = await tx.grade.findFirst({
        where: { submissionId: current.id, deletedAt: null },
      })
      const history = Array.isArray(current.revisionHistory)
        ? current.revisionHistory
        : []
      const snapshot = JSON.parse(
        JSON.stringify({
          payload: current.payload,
          status: current.status,
          submittedAt: current.submittedAt,
          grade,
          replacedAt: now,
        }),
      ) as Prisma.InputJsonObject
      // Soft deletion preserves foreign references; the history retains the full grade.
      if (grade)
        await tx.grade.update({ where: { id: grade.id }, data: { deletedAt: now } })
      // Derived feedback belongs to the previous payload, and must not surface on its replacement.
      await tx.aiFeedbackDraft.updateMany({
        where: { submissionId: current.id, deletedAt: null },
        data: { deletedAt: now },
      })
      await tx.aiObjectiveExplanation.updateMany({
        where: { submissionId: current.id, deletedAt: null },
        data: { deletedAt: now },
      })
      const submission = await tx.submission.update({
        where: { id: current.id },
        data: {
          status,
          submittedAt,
          deletedAt: null,
          payload: {
            ...payload,
            version: current.status === 'draft' ? version : version + 1,
          },
          revisionHistory: [...history, snapshot] as Prisma.InputJsonArray,
        },
      })
      return { submission, previous: current, changed: true }
    }
    const submission = await tx.submission.create({
      data: {
        assignmentId: assignment.id,
        studentId: input.studentId,
        status,
        submittedAt,
        payload: { ...payload, version: 1 },
      },
    })
    return { submission, previous: null, changed: true }
  })
}
