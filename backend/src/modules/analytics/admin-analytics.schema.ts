/** Admin reporting: strict UTC days and bounded ranges keep every export reproducible. */
import { z } from 'zod'

const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`)
    return Number.isFinite(date.getTime()) && date.toISOString().startsWith(value)
  }, 'Use a valid UTC date.')

export const adminAnalyticsQuerySchema = z
  .object({
    from: day.optional(),
    to: day.optional(),
    courseId: z.string().uuid().optional(),
    format: z.enum(['json', 'csv']).default('json'),
  })
  .strict()
  .transform((query) => {
    const today = new Date().toISOString().slice(0, 10)
    const to = query.to ?? today
    const end = new Date(`${to}T00:00:00Z`)
    const from =
      query.from ?? new Date(end.getTime() - 29 * 86400000).toISOString().slice(0, 10)
    return {
      ...query,
      from,
      to,
      start: new Date(`${from}T00:00:00Z`),
      end: new Date(end.getTime() + 86400000),
    }
  })
  .refine(
    (q) => q.start < q.end && q.end.getTime() - q.start.getTime() <= 366 * 86400000,
    'Choose an ordered range of at most 366 UTC days.',
  )
  .refine(
    (q) => q.to <= new Date().toISOString().slice(0, 10),
    'Future dates are not available.',
  )

export type AdminAnalyticsFilters = z.infer<typeof adminAnalyticsQuerySchema>
