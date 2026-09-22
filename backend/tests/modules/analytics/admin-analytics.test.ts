/** Admin report regressions: UTC ranges, authorization, and safe lossless exports. */
import { afterEach, describe, expect, it, vi } from 'vitest'
vi.mock('../../../src/config/prismaClient.js', () => ({
  prisma: { $transaction: vi.fn() },
}))
import { adminAnalyticsQuerySchema } from '../../../src/modules/analytics/admin-analytics.schema.js'
import { getAdminAnalytics } from '../../../src/modules/analytics/admin-analytics.service.js'
import { serializeAdminCsv } from '../../../src/modules/analytics/admin-analytics.controller.js'

afterEach(() => vi.useRealTimers())
describe('admin analytics', () => {
  it('defaults to exactly thirty calendar days including today in UTC', () => {
    vi.useFakeTimers().setSystemTime(new Date('2026-09-22T23:59:59Z'))
    const filters = adminAnalyticsQuerySchema.parse({})
    expect(filters.from).toBe('2026-08-24')
    expect(filters.end.toISOString()).toBe('2026-09-23T00:00:00.000Z')
    expect(filters.end.getTime() - filters.start.getTime()).toBe(30 * 86400000)
  })
  it('rejects invalid, unbounded, future and unexpected filter inputs', () => {
    vi.useFakeTimers().setSystemTime(new Date('2026-09-22T12:00:00Z'))
    for (const query of [
      { from: '2026-02-30' },
      { from: '2024-01-01' },
      { to: '2026-09-23' },
      { from: '2026-09-22', to: '2026-09-21' },
      { role: 'owner' },
      { courseId: 'bad' },
    ]) {
      expect(adminAnalyticsQuerySchema.safeParse(query).success).toBe(false)
    }
  })
  it('includes a leap day and uses exclusive next-day bounds', () => {
    const f = adminAnalyticsQuerySchema.parse({ from: '2024-02-29', to: '2024-02-29' })
    expect(f.end.toISOString()).toBe('2024-03-01T00:00:00.000Z')
  })
  it('rejects non-admin callers before opening any database transaction', async () => {
    const filters = adminAnalyticsQuerySchema.parse({})
    await expect(getAdminAnalytics(undefined, filters)).rejects.toMatchObject({
      statusCode: 401,
    })
    for (const role of ['teacher', 'student'])
      await expect(getAdminAnalytics({ role }, filters)).rejects.toMatchObject({
        statusCode: 403,
      })
  })
  it('preserves zeros and nulls while neutralizing spreadsheet formulas and escaping quotes', () => {
    const csv = serializeAdminCsv({
      filters: { from: '2026-09-01' },
      zero: 0,
      absent: null,
      rows: [{ name: '\u0001=SUM(A1)', title: 'A,"B"\nC', score: 7.5 }],
    })
    expect(csv).toContain('"zero","0"')
    expect(csv).toContain('"absent","Unavailable"')
    expect(csv).toContain('"rows.0.name","\'\u0001=SUM(A1)"')
    expect(csv).toContain('"rows.0.title","A,""B""\nC"')
  })
})
