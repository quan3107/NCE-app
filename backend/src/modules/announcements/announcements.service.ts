/** Course announcements: authorize, persist, and atomically queue one publication per recipient. */
import { createHash } from 'node:crypto'
import { z } from 'zod'
import { prisma } from '../../prisma/client.js'
import { Prisma } from '../../prisma/index.js'
import {
  courseAssignmentAccessWhere,
  createHttpError,
} from '../courses/courses.shared.js'
import type { CourseManager } from '../courses/courses.types.js'

const paramsSchema = z.object({ courseId: z.uuid(), announcementId: z.uuid().optional() })
const contentSchema = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(10000),
  publish: z.boolean().default(false),
})
const createSchema = contentSchema.extend({ requestId: z.uuid() }).strict()
const editSchema = contentSchema
  .extend({ revision: z.number().int().positive() })
  .strict()

async function authorize(
  tx: Prisma.TransactionClient,
  courseId: string,
  actor: CourseManager,
  mode: 'read' | 'write' | 'delete',
) {
  if (
    mode !== 'read' &&
    actor.role !== 'teacher' &&
    !(mode === 'delete' && actor.role === 'admin')
  ) {
    throw createHttpError(403, 'You cannot change course announcements')
  }
  const course = await tx.course.findFirst({
    where: {
      id: courseId,
      ...courseAssignmentAccessWhere(actor, mode === 'read' ? 'read' : 'manage'),
    },
    select: { id: true, title: true },
  })
  if (!course) throw createHttpError(403, 'You do not have access to this course')
  return course
}

// Serializable retries handle concurrent publication and repeated create requests without duplicate fan-out.
async function transaction<T>(
  work: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(work, { isolationLevel: 'Serializable' })
    } catch (error) {
      if (
        attempt < 3 &&
        error instanceof Prisma.PrismaClientKnownRequestError &&
        ['P2034', 'P2002'].includes(error.code)
      )
        continue
      throw error
    }
  }
}

async function publish(
  tx: Prisma.TransactionClient,
  announcement: { id: string; courseId: string; title: string; body: string },
  courseTitle: string,
) {
  const recipients = await tx.enrollment.findMany({
    where: {
      courseId: announcement.courseId,
      roleInCourse: 'student',
      deletedAt: null,
      user: { role: 'student', deletedAt: null },
    },
    select: { userId: true },
  })
  await tx.notification.createMany({
    data: recipients.flatMap(({ userId }) =>
      (['inapp', 'email'] as const).map((channel) => ({
        announcementId: announcement.id,
        userId,
        channel,
        type: 'announcement',
        status: 'queued' as const,
        payload: {
          announcementId: announcement.id,
          courseId: announcement.courseId,
          courseTitle,
          title: announcement.title,
          message: announcement.body,
          link: `/student/courses/${announcement.courseId}/announcements`,
        },
      })),
    ),
    skipDuplicates: true,
  })
}

export async function listAnnouncements(
  params: unknown,
  query: unknown,
  actor: CourseManager,
) {
  const { courseId } = paramsSchema.parse(params)
  const { offset, limit } = z
    .object({
      offset: z.coerce.number().int().min(0).default(0),
      limit: z.coerce.number().int().min(1).max(50).default(20),
    })
    .parse(query)
  return transaction(async (tx) => {
    await authorize(tx, courseId, actor, 'read')
    const rows = await tx.courseAnnouncement.findMany({
      where: {
        courseId,
        deletedAt: null,
        ...(actor.role === 'student' ? { publishedAt: { not: null } } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: offset,
      take: limit + 1,
    })
    return {
      data: rows.slice(0, limit).map(display),
      nextOffset: rows.length > limit ? offset + limit : null,
    }
  })
}

function display(row: {
  id: string
  courseId: string
  title: string
  body: string
  revision: number
  publishedAt: Date | null
  createdAt: Date
  updatedAt: Date
}) {
  const { id, courseId, title, body, revision, publishedAt, createdAt, updatedAt } = row
  return { id, courseId, title, body, revision, publishedAt, createdAt, updatedAt }
}

export async function createAnnouncement(
  params: unknown,
  payload: unknown,
  actor: CourseManager,
) {
  const { courseId } = paramsSchema.parse(params)
  const data = createSchema.parse(payload)
  const requestHash = createHash('sha256')
    .update(JSON.stringify({ courseId, ...data }))
    .digest('hex')
  return transaction(async (tx) => {
    const course = await authorize(tx, courseId, actor, 'write')
    const previous = await tx.courseAnnouncement.findUnique({
      where: { creatorId_requestId: { creatorId: actor.id, requestId: data.requestId } },
    })
    if (previous) {
      if (previous.requestHash !== requestHash || previous.deletedAt)
        throw createHttpError(409, 'This request was already used; reload announcements')
      return display(previous)
    }
    const row = await tx.courseAnnouncement.create({
      data: {
        courseId,
        creatorId: actor.id,
        requestId: data.requestId,
        requestHash,
        title: data.title,
        body: data.body,
        publishedAt: data.publish ? new Date() : null,
      },
    })
    if (data.publish) await publish(tx, row, course.title)
    return display(row)
  })
}

export async function editAnnouncement(
  params: unknown,
  payload: unknown,
  actor: CourseManager,
) {
  const { courseId, announcementId } = paramsSchema.required().parse(params)
  const data = editSchema.parse(payload)
  return transaction(async (tx) => {
    const course = await authorize(tx, courseId, actor, 'write')
    const previous = await tx.courseAnnouncement.findFirst({
      where: { id: announcementId, courseId, deletedAt: null },
    })
    if (!previous) throw createHttpError(404, 'Announcement not found')
    // Identical retries are no-ops, even after the original revision committed.
    if (
      previous.title === data.title &&
      previous.body === data.body &&
      (!data.publish || previous.publishedAt)
    )
      return display(previous)
    if (previous.revision !== data.revision)
      throw createHttpError(409, 'Announcement changed; reload before editing')
    const firstPublish = data.publish && !previous.publishedAt
    const row = await tx.courseAnnouncement.update({
      where: { id: announcementId },
      data: {
        title: data.title,
        body: data.body,
        revision: { increment: 1 },
        ...(firstPublish ? { publishedAt: new Date() } : {}),
      },
    })
    if (firstPublish) await publish(tx, row, course.title)
    return display(row)
  })
}

export async function deleteAnnouncement(params: unknown, actor: CourseManager) {
  const { courseId, announcementId } = paramsSchema.required().parse(params)
  await transaction(async (tx) => {
    await authorize(tx, courseId, actor, 'delete')
    const row = await tx.courseAnnouncement.findFirst({
      where: { id: announcementId, courseId },
    })
    if (!row) throw createHttpError(404, 'Announcement not found')
    if (row.deletedAt) return
    const deletedAt = new Date()
    await tx.courseAnnouncement.update({
      where: { id: announcementId },
      data: { deletedAt },
    })
    await tx.notification.updateMany({
      where: { announcementId, deletedAt: null },
      data: { deletedAt },
    })
  })
}
