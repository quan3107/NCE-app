/**
 * File: src/modules/analytics/analytics.filters.ts
 * Purpose: Build Prisma filters for authorized analytics courses and submission dates.
 * Why: Keeps client-selected filters additive to owner and co-teacher access scope.
 */
import { EnrollmentRole, Prisma } from '../../prisma/index.js'

import type { AnalyticsFilters } from './analytics.schema.js'

type AnalyticsActor = {
  id: string
  role: string
}

const coTeacherEnrollment = (userId: string): Prisma.EnrollmentListRelationFilter => ({
  some: {
    userId,
    roleInCourse: EnrollmentRole.teacher,
    deletedAt: null,
  },
})

export const buildAnalyticsCourseWhere = (
  actor: AnalyticsActor,
  filters: AnalyticsFilters,
): Prisma.CourseWhereInput => {
  const clauses: Prisma.CourseWhereInput[] = [
    { deletedAt: null },
    {
      OR: [{ ownerId: actor.id }, { enrollments: coTeacherEnrollment(actor.id) }],
    },
  ]

  if (filters.courseId) {
    clauses.push({ id: filters.courseId })
  }
  if (filters.cohort) {
    clauses.push({
      scheduleJson: { path: ['label'], equals: filters.cohort },
    })
  }
  if (filters.role === 'owner') {
    clauses.push({ ownerId: actor.id })
  }
  if (filters.role === 'coTeacher') {
    clauses.push({ enrollments: coTeacherEnrollment(actor.id) })
  }

  return { AND: clauses }
}

export const buildAnalyticsSubmissionDateWhere = (
  filters: AnalyticsFilters,
): Prisma.SubmissionWhereInput | undefined => {
  if (!filters.from && !filters.toExclusive) {
    return undefined
  }

  const bounds: Prisma.DateTimeFilter = {
    ...(filters.from ? { gte: filters.from } : {}),
    ...(filters.toExclusive ? { lt: filters.toExclusive } : {}),
  }

  return {
    OR: [
      { submittedAt: { not: null, ...bounds } },
      { submittedAt: null, createdAt: bounds },
    ],
  }
}
