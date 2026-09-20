/**
 * File: src/config/r2.ts
 * Purpose: Read private R2 settings at the storage boundary.
 * Why: Unconfigured deployments must fail closed without disabling unrelated APIs.
 */
import { z } from 'zod'
import { createHttpError } from '../utils/httpError.js'

const settingsSchema = z.object({
  accountId: z.string().regex(/^[a-f0-9]{32}$/i),
  bucket: z
    .string()
    .min(3)
    .max(63)
    .regex(/^[a-z0-9][a-z0-9.-]*[a-z0-9]$/),
  accessKeyId: z.string().min(1),
  secretAccessKey: z.string().min(32),
  jurisdiction: z.enum(['default', 'eu', 'us', 'fedramp']),
})

export function getR2Settings() {
  const result = settingsSchema.safeParse({
    accountId: process.env.R2_ACCOUNT_ID?.trim(),
    bucket: process.env.R2_BUCKET?.trim(),
    accessKeyId: process.env.R2_ACCESS_KEY_ID?.trim(),
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY?.trim(),
    jurisdiction: process.env.R2_JURISDICTION?.trim() || 'default',
  })
  if (!result.success) {
    // Never include validation input or provider credentials in API/log errors.
    throw createHttpError(
      503,
      'File storage is not configured. Contact the administrator.',
    )
  }
  const settings = result.data
  const jurisdiction =
    settings.jurisdiction === 'default' ? '' : `.${settings.jurisdiction}`
  return {
    ...settings,
    endpoint: `https://${settings.accountId}${jurisdiction}.r2.cloudflarestorage.com`,
  }
}
