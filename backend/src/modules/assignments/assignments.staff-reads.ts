/** Staff collection reads: scoped counts and small pages keep essays/configs off overview routes. */
import { z } from 'zod'
import { prisma } from '../../prisma/client.js'
import { Prisma, UserRole } from '../../prisma/index.js'
import { collectionPage, collectionPageQuerySchema } from '../../utils/collectionPage.js'
import { createHttpError, createNotFoundError } from '../../utils/httpError.js'
import { courseAssignmentAccessWhere } from '../courses/courses.shared.js'
import type { CourseManager } from '../courses/courses.types.js'

function assignmentWhere(actor: CourseManager): Prisma.AssignmentWhereInput {
  if (actor.role !== UserRole.teacher && actor.role !== UserRole.admin) {
    throw createHttpError(403, 'Only teachers and admins can read staff summaries.')
  }
  return { deletedAt: null, course: courseAssignmentAccessWhere(actor, 'read') }
}

const summarySelect = {
  id: true,
  assignmentId: true,
  studentId: true,
  status: true,
  submittedAt: true,
  student: { select: { fullName: true } },
  assignment: { select: { title: true } },
} satisfies Prisma.SubmissionSelect

type SummaryRow = Prisma.SubmissionGetPayload<{ select: typeof summarySelect }>
function summarize({ student, assignment, ...row }: SummaryRow) {
  return { ...row, studentName: student.fullName, assignmentTitle: assignment.title }
}

export async function getStaffOverview(actor: CourseManager) {
  const scope = assignmentWhere(actor)
  const where: Prisma.SubmissionWhereInput = {
    deletedAt: null,
    assignment: scope,
    status: { in: ['submitted', 'late'] },
  }
  const [activeAssignments, pendingSubmissions, recent] = await Promise.all([
    prisma.assignment.count({ where: { ...scope, publishedAt: { not: null } } }),
    prisma.submission.count({ where }),
    prisma.submission.findMany({
      where,
      select: summarySelect,
      take: 3,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    }),
  ])
  return {
    activeAssignments,
    pendingSubmissions,
    recentSubmissions: recent.map(summarize),
  }
}

export async function listStaffAssignments(query: unknown, actor: CourseManager) {
  const { cursor, limit } = collectionPageQuerySchema.parse(query)
  const where = assignmentWhere(actor)
  const [rows, total] = await Promise.all([
    prisma.assignment.findMany({
      where,
      take: limit + 1,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        courseId: true,
        title: true,
        type: true,
        dueAt: true,
        publishedAt: true,
        course: { select: { title: true } },
        _count: { select: { submissions: { where: { deletedAt: null } } } },
      },
    }),
    prisma.assignment.count({ where }),
  ])
  return {
    ...collectionPage(
      rows.map(({ course, _count, ...row }) => ({
        ...row,
        courseName: course.title,
        submissionCount: _count.submissions,
      })),
      limit,
    ),
    total,
  }
}

const submissionPageSchema = collectionPageQuerySchema.extend({
  assignmentId: z.string().uuid().optional(),
  pending: z.enum(['true', 'false']).default('true'),
})

export async function listStaffSubmissions(query: unknown, actor: CourseManager) {
  const { cursor, limit, assignmentId, pending } = submissionPageSchema.parse(query)
  const assignment = {
    ...assignmentWhere(actor),
    ...(assignmentId ? { id: assignmentId } : {}),
  }
  const where: Prisma.SubmissionWhereInput = {
    deletedAt: null,
    assignment,
    ...(pending === 'true' ? { status: { in: ['submitted', 'late'] } } : {}),
  }
  // Grading can remove the boundary row from the pending filter between page requests.
  // Prisma cursor + skip:1 then skips the first remaining row. Exclude the ID
  // instead; native cursor ordering retains PostgreSQL's timestamp precision.
  // The anchor retains course scope without requiring pending/active-row status.
  const anchor = cursor
    ? await prisma.submission.findFirst({
        where: { id: cursor, assignment },
        select: { id: true },
      })
    : null
  if (cursor && !anchor) throw createNotFoundError('Submission cursor', cursor)
  const [rows, total] = await Promise.all([
    prisma.submission.findMany({
      where: { ...where, ...(cursor ? { id: { not: cursor } } : {}) },
      select: summarySelect,
      take: limit + 1,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...(cursor ? { cursor: { id: cursor } } : {}),
    }),
    prisma.submission.count({ where }),
  ])
  return { ...collectionPage(rows.map(summarize), limit), total }
}

export async function getStaffAssignment(id: unknown, actor: CourseManager) {
  const assignmentId = z.string().uuid().parse(id)
  const assignment = await prisma.assignment.findFirst({
    where: { ...assignmentWhere(actor), id: assignmentId },
    include: { course: { select: { title: true } } },
  })
  if (!assignment) throw createNotFoundError('Assignment', assignmentId)
  const counts = await prisma.submission.groupBy({
    by: ['status'],
    where: { assignmentId, deletedAt: null },
    _count: { _all: true },
  })
  const count = (statuses: string[]) =>
    counts.reduce(
      (total, row) => total + (statuses.includes(row.status) ? row._count._all : 0),
      0,
    )
  const { course, ...data } = assignment
  return {
    assignment: { ...data, courseName: course.title },
    counts: {
      total: count(['draft', 'submitted', 'late', 'graded']),
      submitted: count(['submitted', 'late', 'graded']),
      pending: count(['submitted', 'late']),
      graded: count(['graded']),
      late: count(['late']),
    },
  }
}

export async function getStaffSubmission(id: unknown, actor: CourseManager) {
  const submissionId = z.string().uuid().parse(id)
  const submission = await prisma.submission.findFirst({
    where: { id: submissionId, deletedAt: null, assignment: assignmentWhere(actor) },
    include: { assignment: { include: { course: { select: { title: true } } } } },
  })
  if (!submission) throw createNotFoundError('Submission', submissionId)
  const { assignment, ...data } = submission
  const { course, ...assignmentData } = assignment
  return { submission: data, assignment: { ...assignmentData, courseName: course.title } }
}
