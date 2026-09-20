/**
 * File: src/modules/files/upload-intent.ts
 * Purpose: Authenticate issued upload metadata without trusting completion payloads.
 * Why: A scoped, expiring intent rejects foreign keys and survives API restarts.
 */
import { createHmac, timingSafeEqual } from 'node:crypto'
import { z } from 'zod'
import { getR2Settings } from '../../config/r2.js'
import { createHttpError } from '../../utils/httpError.js'

const intentSchema = z
  .object({
    id: z.string().uuid(),
    ownerId: z.string().uuid(),
    bucket: z.string(),
    objectKey: z.string(),
    mime: z.string(),
    size: z.number().int().positive(),
    checksum: z.string().regex(/^[a-f0-9]{64}$/),
    expiresAt: z.number().int().positive(),
  })
  .strict()
export type UploadIntent = z.infer<typeof intentSchema>

function signature(payload: string): Buffer {
  const key = createHmac('sha256', getR2Settings().secretAccessKey)
    .update('nce:r2:upload-intent:v1')
    .digest()
  return createHmac('sha256', key).update(payload).digest()
}

export function issueUploadToken(intent: UploadIntent): string {
  const payload = Buffer.from(JSON.stringify(intentSchema.parse(intent))).toString(
    'base64url',
  )
  return `${payload}.${signature(payload).toString('base64url')}`
}

export function readUploadToken(token: string, ownerId: string): UploadIntent {
  const [payload, mac, extra] = token.split('.')
  const invalid = () =>
    createHttpError(400, 'Upload intent is invalid or expired. Upload the file again.')
  if (!payload || !mac || extra) throw invalid()
  const expected = signature(payload)
  const actual = Buffer.from(mac, 'base64url')
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
    throw invalid()
  let parsed: unknown
  try {
    parsed = JSON.parse(Buffer.from(payload, 'base64url').toString())
  } catch {
    throw invalid()
  }
  const result = intentSchema.safeParse(parsed)
  if (
    !result.success ||
    result.data.ownerId !== ownerId ||
    result.data.expiresAt <= Date.now()
  )
    throw invalid()
  if (result.data.bucket !== getR2Settings().bucket) throw invalid()
  return result.data
}
