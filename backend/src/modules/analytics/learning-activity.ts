/** Learning participation: authorized resource views and successful writes share daily deduplication. */
import { z } from 'zod'
import type { Request, Response } from 'express'
import { prisma, runWithRole } from '../../config/prismaClient.js'
import { createHttpError } from '../../utils/httpError.js'

export async function recordLearningActivity(
  actor: { id: string; role: string } | undefined,
  courseId: string,
) {
  if (actor?.role !== 'student') return
  // Database time, enrollment validation and the unique daily key apply even to concurrent retries.
  await prisma.$executeRaw`INSERT INTO learning_activity_days (student_id, course_id, day)
    SELECT u.id, e.course_id, (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date
    FROM users u JOIN enrollments e ON e.user_id = u.id JOIN courses c ON c.id = e.course_id
    WHERE u.id = ${actor.id}::uuid AND e.course_id = ${courseId}::uuid
      AND u.role = 'student' AND u.status = 'active' AND u."deletedAt" IS NULL
      AND e.role_in_course = 'student' AND e."deletedAt" IS NULL AND c."deletedAt" IS NULL
    ON CONFLICT DO NOTHING`
}

const lessonView = z
  .object({ courseId: z.string().uuid(), lessonId: z.string().uuid() })
  .strict()
export async function postLessonView(req: Request, res: Response) {
  if (req.user?.role !== 'student') throw createHttpError(403, 'Forbidden')
  const actor = req.user
  const { courseId, lessonId } = lessonView.parse(req.body)
  const assigned = await runWithRole(
    { role: 'service_role', userId: actor.id, userRole: actor.role },
    () =>
      prisma.nceCourseLessonAssignment.findFirst({
        where: {
          courseId,
          lessonId,
          OR: [{ availableFrom: null }, { availableFrom: { lte: new Date() } }],
          course: {
            deletedAt: null,
            enrollments: {
              some: { userId: actor.id, roleInCourse: 'student', deletedAt: null },
            },
          },
          lesson: {
            deletedAt: null,
            status: 'published',
            unit: {
              deletedAt: null,
              status: 'published',
              book: { deletedAt: null, status: 'published' },
            },
          },
        },
        select: { id: true },
      }),
  )
  if (!assigned) throw createHttpError(404, 'Available enrolled lesson not found')
  await recordLearningActivity(req.user, courseId)
  res.status(204).send()
}
