/**
 * Location: tests/modules/files/files.recovery.test.ts
 * Purpose: Exercise real promotion logic across persistence failures and races.
 * Why: Verified uploads must remain recoverable without overwriting accepted media.
 */
import { Readable } from 'node:stream'
import { createHash } from 'node:crypto'
import { beforeEach, expect, test, vi } from 'vitest'

const state = vi.hoisted(() => ({
  objects: new Map<string, { bytes: Buffer; mime: string }>(),
  saved: null as Record<string, unknown> | null,
  failInsert: false,
  writes: 0,
  deletes: 0,
}))
vi.mock('../../../src/config/r2.js', () => ({
  getR2Settings: () => ({
    bucket: 'test-bucket',
    secretAccessKey: 'test-secret',
    endpoint: 'https://example.invalid',
  }),
}))
vi.mock('../../../src/modules/file-upload-config/file-upload-config.service.js', () => ({
  getRoleFileUploadConfig: async () => ({
    limits: { max_file_size: 1024 },
    allowedMimeTypes: new Set(['audio/wav']),
    allowedExtensions: new Set(['.wav']),
  }),
}))
vi.mock('../../../src/prisma/client.js', () => ({
  prisma: {
    file: {
      findFirst: vi.fn(async () => state.saved),
      create: vi.fn(async ({ data }) => {
        if (state.failInsert) {
          state.failInsert = false
          throw new Error('database unavailable')
        }
        if (state.saved) throw Object.assign(new Error('duplicate'), { code: 'P2002' })
        state.saved = data
        return data
      }),
    },
  },
}))
vi.mock('@aws-sdk/client-s3', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@aws-sdk/client-s3')>()
  return {
    ...actual,
    S3Client: class {
      destroy() {}
      async send(command: { constructor: { name: string }; input: { Key: string; IfNoneMatch?: string; ContentType: string; Body: Readable } }) {
        const input = command.input
        if (command.constructor.name === 'GetObjectCommand') {
          const object = state.objects.get(input.Key)
          if (!object) throw new Error('missing staging object')
          return {
            Body: Readable.from([object.bytes]),
            ContentLength: object.bytes.length,
            ContentType: object.mime,
          }
        }
        if (command.constructor.name === 'DeleteObjectCommand') {
          expect(state.saved).not.toBeNull()
          state.deletes++
          state.objects.delete(input.Key)
          return {}
        }
        expect(input.IfNoneMatch).toBe('*')
        if (state.objects.has(input.Key)) {
          input.Body.destroy()
          throw { $metadata: { httpStatusCode: 412 } }
        }
        const chunks: Buffer[] = []
        for await (const chunk of input.Body) chunks.push(Buffer.from(chunk))
        // Model conditional writes atomically, including concurrent body reads.
        if (state.objects.has(input.Key)) throw { $metadata: { httpStatusCode: 412 } }
        state.objects.set(input.Key, {
          bytes: Buffer.concat(chunks),
          mime: input.ContentType,
        })
        state.writes++
        return {}
      }
    },
  }
})
import { completeFileUpload } from '../../../src/modules/files/files.service.js'
import { issueUploadToken } from '../../../src/modules/files/upload-intent.js'

const ownerId = '11111111-1111-4111-8111-111111111111'
const bytes = Buffer.from('verified recording')
const intent = {
  id: '22222222-2222-4222-8222-222222222222',
  ownerId,
  bucket: 'test-bucket',
  objectKey: `pending/${ownerId}/recording.wav`,
  mime: 'audio/wav',
  size: bytes.length,
  checksum: createHash('sha256').update(bytes).digest('hex'),
  expiresAt: Date.now() + 600_000,
}
const payload = {
  bucket: intent.bucket,
  objectKey: intent.objectKey,
  mime: intent.mime,
  size: intent.size,
  checksum: intent.checksum,
  uploadToken: issueUploadToken(intent),
}

beforeEach(() => {
  state.objects.clear()
  state.saved = null
  state.failInsert = false
  state.writes = 0
  state.deletes = 0
  state.objects.set(intent.objectKey, { bytes, mime: intent.mime })
})
test('retains staging after successful promotion and failed insert, then recovers', async () => {
  state.failInsert = true
  await expect(completeFileUpload(payload, ownerId, 'student')).rejects.toThrow(
    'database unavailable',
  )
  expect(state.writes).toBe(1)
  expect(state.objects.has(intent.objectKey)).toBe(true)
  expect(state.deletes).toBe(0)
  const recovered = await completeFileUpload(payload, ownerId, 'student')
  expect(recovered.id).toBe(intent.id)
  expect(state.writes).toBe(1)
  expect(state.objects.has(intent.objectKey)).toBe(false)
})
test('overlapping completions return one record without overwriting final bytes', async () => {
  const results = await Promise.all([
    completeFileUpload(payload, ownerId, 'student'),
    completeFileUpload(payload, ownerId, 'student'),
  ])
  expect(results.map((result) => result.id)).toEqual([intent.id, intent.id])
  expect(state.writes).toBe(1)
})
test('does not recover from unverified replacement bytes after a failed insert', async () => {
  state.failInsert = true
  await expect(completeFileUpload(payload, ownerId, 'student')).rejects.toThrow()
  state.objects.set(intent.objectKey, {
    bytes: Buffer.alloc(bytes.length),
    mime: intent.mime,
  })
  await expect(completeFileUpload(payload, ownerId, 'student')).rejects.toMatchObject({
    statusCode: 400,
  })
  expect(state.saved).toBeNull()
  expect(state.writes).toBe(1)
})
