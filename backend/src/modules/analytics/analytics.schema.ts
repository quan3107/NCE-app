/**
 * File: src/modules/analytics/analytics.schema.ts
 * Purpose: Validate and normalize analytics query filters.
 * Why: Gives JSON and CSV analytics one strict UTC filter contract.
 */
import { z } from 'zod'

const UTC_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

const utcDate = z
  .string()
  .regex(UTC_DATE_PATTERN)
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`)
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value)
  }, 'Expected a valid date in YYYY-MM-DD format.')

const rawAnalyticsQuerySchema = z.object({
  from: utcDate.optional(),
  to: utcDate.optional(),
  courseId: z.string().uuid().optional(),
  cohort: z.string().trim().min(1).max(100).optional(),
  role: z.enum(['owner', 'coTeacher']).optional(),
  format: z.enum(['json', 'csv']).default('json'),
})

export const analyticsQuerySchema = rawAnalyticsQuerySchema
  .refine(({ from, to }) => !from || !to || from <= to, {
    message: 'from must be on or before to.',
    path: ['to'],
  })
  .transform((query) => {
    const from = query.from ? new Date(`${query.from}T00:00:00.000Z`) : undefined
    const toExclusive = query.to ? new Date(`${query.to}T00:00:00.000Z`) : undefined
    if (toExclusive) {
      toExclusive.setUTCDate(toExclusive.getUTCDate() + 1)
    }

    return {
      ...query,
      from,
      toExclusive,
    }
  })

export type AnalyticsFilters = z.infer<typeof analyticsQuerySchema>
