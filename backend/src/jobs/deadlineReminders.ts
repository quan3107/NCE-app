/** Queue each deadline occurrence once per student/channel, with durable retry deduplication. */
import { prisma } from '../prisma/client.js'

export async function handleDueSoonJob(): Promise<void> {
  const now = new Date()
  // Minute polling catches up after outages, never before T-24h or after due.
  const assignments = await prisma.assignment.findMany({
    where: {
      deletedAt: null,
      publishedAt: { not: null },
      dueAt: { gt: now, lte: new Date(now.getTime() + 24 * 60 * 60 * 1000) },
      course: { deletedAt: null },
    },
    include: {
      course: {
        select: {
          title: true,
          enrollments: {
            where: {
              deletedAt: null,
              roleInCourse: 'student',
              remindersMuted: false,
              user: { deletedAt: null, role: 'student', status: 'active' },
            },
            select: { userId: true },
          },
        },
      },
    },
  })
  for (const assignment of assignments) {
    const dueAt = assignment.dueAt!.toISOString()
    const data = assignment.course.enrollments.flatMap(({ userId }) =>
      (['inapp', 'email'] as const).map((channel) => ({
        userId,
        type: 'due_soon',
        channel,
        status: 'queued' as const,
        reminderKey: `${assignment.id}:${dueAt}:${userId}:${channel}`,
        payload: {
          assignmentId: assignment.id,
          assignmentTitle: assignment.title,
          courseId: assignment.courseId,
          courseTitle: assignment.course.title,
          dueAt,
          reminderHours: 24,
        },
      })),
    )
    if (data.length) await prisma.notification.createMany({ data, skipDuplicates: true })
  }
}

export async function isReminderEligible(
  userId: string,
  payload: unknown,
  delivery = true,
): Promise<boolean> {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false
  const { assignmentId, dueAt, courseId } = payload as Record<string, unknown>
  if (
    typeof assignmentId !== 'string' ||
    typeof dueAt !== 'string' ||
    typeof courseId !== 'string'
  )
    return false
  const deadline = new Date(dueAt)
  const now = new Date()
  if (
    !Number.isFinite(deadline.getTime()) ||
    (delivery &&
      (deadline <= now || deadline.getTime() > now.getTime() + 24 * 60 * 60 * 1000))
  )
    return false
  return Boolean(
    await prisma.assignment.findFirst({
      where: {
        id: assignmentId,
        courseId,
        // JSON/Prisma dates use millisecond precision, including legacy SQL-created rows.
        dueAt: { gte: deadline, lt: new Date(deadline.getTime() + 1) },
        deletedAt: null,
        publishedAt: { not: null },
        course: {
          deletedAt: null,
          enrollments: {
            some: {
              userId,
              roleInCourse: 'student',
              deletedAt: null,
              remindersMuted: false,
              user: { deletedAt: null, role: 'student', status: 'active' },
            },
          },
        },
      },
      select: { id: true },
    }),
  )
}
