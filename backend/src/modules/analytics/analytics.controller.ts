/**
 * File: src/modules/analytics/analytics.controller.ts
 * Purpose: Handle analytics HTTP requests for aggregated metrics.
 * Why: Keeps routing thin while delegating aggregation to services.
 */
import { type Request, type Response } from 'express'

import { serializeTeacherAnalyticsCsv } from './analytics.csv.js'
import { analyticsQuerySchema } from './analytics.schema.js'
import { getTeacherAnalytics } from './analytics.service.js'

export async function getTeacherAnalyticsHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const filters = analyticsQuerySchema.parse(req.query)
  const payload = await getTeacherAnalytics(req.user, filters)

  if (filters.format === 'csv') {
    res
      .status(200)
      .set({
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="teacher-analytics.csv"',
      })
      .send(serializeTeacherAnalyticsCsv(payload))
    return
  }

  res.status(200).json(payload)
}
