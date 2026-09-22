/** Admin report: one database snapshot serves JSON and CSV without exposing learning content. */
import { prisma } from '../../config/prismaClient.js'
import { createHttpError } from '../../utils/httpError.js'
import type { AdminAnalyticsFilters } from './admin-analytics.schema.js'
import { adminAnalyticsSql } from './admin-analytics.query.js'

import type { AdminAnalytics } from './admin-analytics.types.js'

export async function getAdminAnalytics(
  actor: { role: string } | undefined,
  filters: AdminAnalyticsFilters,
): Promise<AdminAnalytics> {
  if (!actor) throw createHttpError(401, 'Unauthorized')
  if (actor.role !== 'admin') throw createHttpError(403, 'Forbidden')
  return prisma.$transaction(
    async (tx) => {
      // NCE progress is service-only; the authoritative admin check above gates this aggregate-only read.
      await tx.$executeRaw`SET LOCAL ROLE service_role`
      await tx.$executeRaw`SET LOCAL statement_timeout = '10s'`
      await tx.$executeRaw`SET LOCAL TIME ZONE 'UTC'`
      if (
        filters.courseId &&
        !(await tx.course.findFirst({
          where: { id: filters.courseId, deletedAt: null },
          select: { id: true },
        }))
      ) {
        throw createHttpError(404, 'Course not found')
      }
      const [row] = await tx.$queryRaw<{ payload: AdminAnalytics }[]>(
        adminAnalyticsSql(filters),
      )
      const data = row.payload
      if (data.progress.length > 500 || data.results.length > 500)
        throw createHttpError(
          422,
          'Report exceeds 500 rows. Choose a course or narrower date range.',
        )
      data.filters = {
        from: filters.from,
        to: filters.to,
        courseId: filters.courseId ?? null,
        timezone: 'UTC',
      }
      data.engagement.studentsTruncated = data.engagement.students.length > 100
      data.engagement.students = data.engagement.students.slice(0, 100)
      return data
    },
    { timeout: 15000, isolationLevel: 'RepeatableRead' },
  )
}
