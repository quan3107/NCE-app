/**
 * File: src/modules/assignments/assignments.authorization.ts
 * Purpose: Build assignment authorization filters from authenticated course roles.
 * Why: Keeps assignment CRUD queries consistently scoped to the actor's course access.
 */
import { courseAssignmentAccessWhere } from '../courses/courses.shared.js'
import type { CourseManager } from '../courses/courses.types.js'
import { prisma } from '../../prisma/client.js'
import { Prisma, UserRole } from '../../prisma/index.js'
import { createHttpError } from '../../utils/httpError.js'

export function assignmentAccessWhere(
  courseId: string,
  actor: CourseManager,
  mode: 'read' | 'manage',
  assignmentId?: string,
): Prisma.AssignmentWhereInput {
  const where: Prisma.AssignmentWhereInput = {
    ...(assignmentId ? { id: assignmentId } : {}),
    courseId,
    deletedAt: null,
    course: courseAssignmentAccessWhere(actor, mode),
  }

  if (mode === 'read' && actor.role === UserRole.student) {
    where.publishedAt = { not: null }
  }

  return where
}

export async function ensureCourseAssignmentAccess(
  courseId: string,
  actor: CourseManager,
): Promise<void> {
  const course = await prisma.course.findFirst({
    where: {
      id: courseId,
      ...courseAssignmentAccessWhere(actor, 'manage'),
    },
    select: { id: true },
  })

  if (!course) {
    throw createHttpError(
      403,
      'You do not have permission to manage assignments for this course',
    )
  }
}
