/**
 * File: src/modules/courses/courses.shared.ts
 * Purpose: Provide shared helpers for course service modules.
 * Why: Avoids duplicating error handling and access control logic across course services.
 */
import type { CourseManager } from './courses.types.js'
import { prisma } from '../../config/prismaClient.js'
import { EnrollmentRole, Prisma, UserRole } from '../../prisma/index.js'

export type HttpError = Error & {
  statusCode?: number
  expose?: boolean
  details?: unknown
}

export const createHttpError = (statusCode: number, message: string): HttpError => {
  const error = new Error(message) as HttpError
  error.statusCode = statusCode
  error.expose = statusCode < 500
  return error
}

export const canManageCourse = (ownerId: string, actor: CourseManager): boolean =>
  actor.role === UserRole.admin ||
  (actor.role === UserRole.teacher && actor.id === ownerId)

export type CourseAccessRole = 'admin' | 'owner' | 'coTeacher' | 'student' | 'none'

export type CourseAccessEnrollment = {
  userId: string
  roleInCourse: EnrollmentRole
  deletedAt?: Date | null
}

export function getCourseAccessRole(
  ownerId: string,
  enrollments: CourseAccessEnrollment[],
  actor: CourseManager,
): CourseAccessRole {
  if (actor.role === UserRole.admin) {
    return 'admin'
  }

  if (actor.role === UserRole.teacher && actor.id === ownerId) {
    return 'owner'
  }

  const activeEnrollment = enrollments.find(
    (enrollment) => enrollment.userId === actor.id && !enrollment.deletedAt,
  )

  if (actor.role === UserRole.teacher && activeEnrollment?.roleInCourse === EnrollmentRole.teacher) {
    return 'coTeacher'
  }

  if (actor.role === UserRole.student && activeEnrollment?.roleInCourse === EnrollmentRole.student) {
    return 'student'
  }

  return 'none'
}

export function courseAssignmentAccessWhere(
  actor: CourseManager,
  mode: 'read' | 'manage',
): Prisma.CourseWhereInput {
  const activeCourse = { deletedAt: null }

  if (actor.role === UserRole.admin) {
    return activeCourse
  }

  if (actor.role === UserRole.teacher) {
    return {
      ...activeCourse,
      OR: [
        { ownerId: actor.id },
        {
          enrollments: {
            some: {
              userId: actor.id,
              roleInCourse: EnrollmentRole.teacher,
              deletedAt: null,
            },
          },
        },
      ],
    }
  }

  if (mode === 'read') {
    return {
      ...activeCourse,
      enrollments: {
        some: {
          userId: actor.id,
          roleInCourse: EnrollmentRole.student,
          deletedAt: null,
        },
      },
    }
  }

  return { id: '00000000-0000-0000-0000-000000000000' }
}

export async function ensureCourseAccessible(courseId: string, actor: CourseManager) {
  const course = await prisma.course.findFirst({
    where: { id: courseId, deletedAt: null },
    select: { id: true, ownerId: true },
  })

  if (!course) {
    throw createHttpError(404, 'Course not found')
  }

  if (!canManageCourse(course.ownerId, actor)) {
    throw createHttpError(403, 'You do not have permission to manage this course')
  }

  return course
}
