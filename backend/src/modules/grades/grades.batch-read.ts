/** Bounded grade reads share single-grade visibility and formatting without HTTP request fanout. */
import { z } from 'zod'
import type { Request, Response } from 'express'
import { prisma } from '../../prisma/client.js'
import { UserRole } from '../../prisma/index.js'
import { createHttpError } from '../../utils/httpError.js'
import { buildGradeReadWhere } from './grades.read-access.js'
import {
  toStudentAiFeedback,
  toProvisionalOnlyGrade,
  feedbackLabelForGrade,
  type getGrade,
} from './grades.service.js'
import { recordLearningActivity } from '../analytics/learning-activity.js'
import { getStudentVisibleAiFeedbackDrafts } from '../ai-feedback/ai-feedback.draft-reads.js'

export const gradeBatchSchema = z
  .object({ submissionIds: z.array(z.string().uuid()).min(1).max(100) })
  .strict()
type Actor = { id: string; role: UserRole }

export async function listGrades(payload: unknown, actor?: Actor) {
  const { submissionIds: requested } = gradeBatchSchema.parse(payload)
  const submissionIds = [...new Set(requested)]
  const scope = buildGradeReadWhere(submissionIds[0]!, actor)
  const [grades, drafts] = await Promise.all([
    prisma.grade.findMany({
      where: { ...scope, submissionId: { in: submissionIds } },
      include: {
        grader: { select: { fullName: true } },
        aiFeedbackDrafts: {
          where: {
            deletedAt: null,
            status: { in: ['approved', 'finalized'] },
            visibilityMode: { in: ['teacher_reviewed', 'instant_student_visible'] },
          },
          select: { id: true, status: true, visibilityMode: true },
          orderBy: [{ decidedAt: 'desc' }, { createdAt: 'desc' }],
          take: 1,
        },
      },
    }),
    actor?.role === UserRole.student
      ? getStudentVisibleAiFeedbackDrafts(submissionIds, actor.id)
      : Promise.resolve(new Map<string, never>()),
  ])
  const bySubmission = new Map(grades.map((grade) => [grade.submissionId, grade]))
  return submissionIds.flatMap<Awaited<ReturnType<typeof getGrade>>>((submissionId) => {
    const grade = bySubmission.get(submissionId)
    const draft = drafts.get(submissionId) ?? null
    if (!grade) {
      const provisional = toProvisionalOnlyGrade(draft, submissionId)
      return provisional ? [provisional] : []
    }
    const { grader, aiFeedbackDrafts, ...data } = grade
    const studentAiFeedback = toStudentAiFeedback(draft)
    return [
      {
        ...data,
        graderName: grader.fullName,
        feedbackLabel: feedbackLabelForGrade({ aiFeedbackDrafts }),
        ...(studentAiFeedback ? { studentAiFeedback } : {}),
      },
    ]
  })
}

export async function getGradeBatch(req: Request, res: Response) {
  if (!req.user) throw createHttpError(401, 'Unauthorized')
  const grades = await listGrades(req.body, req.user)
  // Preserve participation semantics once per accessible course, including provisional feedback.
  if (req.user.role === UserRole.student && grades.length) {
    const submissions = await prisma.submission.findMany({
      where: {
        id: { in: grades.map((grade) => grade.submissionId) },
        studentId: req.user.id,
        deletedAt: null,
      },
      select: { assignment: { select: { courseId: true } } },
    })
    for (const courseId of new Set(submissions.map((row) => row.assignment.courseId))) {
      await recordLearningActivity(req.user, courseId)
    }
  }
  res.json({ items: grades })
}
