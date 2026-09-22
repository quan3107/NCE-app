/** Admin JSON/CSV share authentication, validation, report scope and formula-safe serialization. */
import type { Request, Response } from 'express'
import { adminAnalyticsQuerySchema } from './admin-analytics.schema.js'
import { getAdminAnalytics } from './admin-analytics.service.js'

export function serializeAdminCsv(data: unknown): string {
  const rows: string[][] = [['field', 'value']]
  const visit = (value: unknown, key: string) => {
    if (value !== null && typeof value === 'object') {
      for (const [child, item] of Object.entries(value))
        visit(item, key ? `${key}.${child}` : child)
    } else rows.push([key, value === null ? 'Unavailable' : String(value)])
  }
  visit(data, '')
  const escape = (value: string) =>
    `"${(/^[\s\u0000-\u001f\u007f-\u009f]*[=+@-]/u.test(value) ? `'${value}` : value).replaceAll('"', '""')}"`
  return '\uFEFF' + rows.map((row) => row.map(escape).join(',')).join('\r\n') + '\r\n'
}

export async function getAdminAnalyticsHandler(req: Request, res: Response) {
  const filters = adminAnalyticsQuerySchema.parse(req.query)
  const data = await getAdminAnalytics(req.user, filters)
  res.set('Cache-Control', 'no-store')
  if (filters.format === 'csv') {
    res
      .set('Content-Type', 'text/csv; charset=utf-8')
      .set('Content-Disposition', 'attachment; filename="admin-analytics.csv"')
      .send(serializeAdminCsv(data))
  } else res.json(data)
}
