/** Persist a student's own course reminder preference without affecting announcements. */
import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../../prisma/client.js'
import { authGuard } from '../../middleware/authGuard.js'
import { createHttpError } from '../../utils/httpError.js'

export const courseReminderRouter = Router({ mergeParams: true })
courseReminderRouter.use(authGuard)
courseReminderRouter.use(async (req, _res, next) => {
  const courseId = z.uuid().parse(req.params.courseId)
  if (req.user!.role !== 'student')
    throw createHttpError(403, 'Student enrollment required.')
  const enrollment = await prisma.enrollment.findFirst({
    where: {
      courseId,
      userId: req.user!.id,
      roleInCourse: 'student',
      deletedAt: null,
      course: { deletedAt: null },
    },
  })
  if (!enrollment) throw createHttpError(403, 'Student enrollment required.')
  next()
})
courseReminderRouter.get('/', async (req, res) => {
  const row = await prisma.enrollment.findFirst({
    where: {
      courseId: z.object({ courseId: z.uuid() }).parse(req.params).courseId,
      userId: req.user!.id,
      roleInCourse: 'student',
      deletedAt: null,
      course: { deletedAt: null },
    },
  })
  if (!row) throw createHttpError(403, 'Student enrollment required.')
  res.json({ muted: row.remindersMuted })
})
courseReminderRouter.put('/', async (req, res) => {
  const { muted } = z.object({ muted: z.boolean() }).strict().parse(req.body)
  const result = await prisma.enrollment.updateMany({
    where: {
      courseId: z.object({ courseId: z.uuid() }).parse(req.params).courseId,
      userId: req.user!.id,
      roleInCourse: 'student',
      deletedAt: null,
      course: { deletedAt: null },
    },
    data: { remindersMuted: muted },
  })
  if (result.count !== 1) throw createHttpError(403, 'Student enrollment required.')
  res.json({ muted })
})
