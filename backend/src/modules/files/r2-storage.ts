/**
 * File: src/modules/files/r2-storage.ts
 * Purpose: Sign private R2 requests and promote verified uploads to final objects.
 * Why: Reusable PUT URLs must never overwrite media already accepted by the app.
 */
import { createHash } from 'node:crypto'
import { createReadStream, createWriteStream } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pipeline } from 'node:stream/promises'
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { getR2Settings } from '../../config/r2.js'
import { createHttpError } from '../../utils/httpError.js'
import type { UploadIntent } from './upload-intent.js'

export const UPLOAD_TTL_SECONDS = 900
export const DOWNLOAD_TTL_SECONDS = 300

function client() {
  const settings = getR2Settings()
  return new S3Client({
    region: 'auto',
    endpoint: settings.endpoint,
    credentials: {
      accessKeyId: settings.accessKeyId,
      secretAccessKey: settings.secretAccessKey,
    },
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
    maxAttempts: 2,
  })
}

export async function signR2Upload(intent: UploadIntent): Promise<string> {
  const storage = client()
  try {
    return await getSignedUrl(
      storage,
      new PutObjectCommand({
        Bucket: intent.bucket,
        Key: intent.objectKey,
        ContentType: intent.mime,
        ContentLength: intent.size,
      }),
      { expiresIn: UPLOAD_TTL_SECONDS, signableHeaders: new Set(['content-type']) },
    )
  } finally {
    storage.destroy()
  }
}

export function finalObjectKey(intent: UploadIntent): string {
  return intent.objectKey.replace(/^pending\//, 'uploads/')
}

export async function promoteR2Upload(intent: UploadIntent): Promise<string> {
  const storage = client()
  const directory = await mkdtemp(join(tmpdir(), 'nce-upload-'))
  const filename = join(directory, 'verified')
  const signal = AbortSignal.timeout(60_000)
  try {
    const object = await storage.send(
      new GetObjectCommand({ Bucket: intent.bucket, Key: intent.objectKey }),
      { abortSignal: signal },
    )
    const body = object.Body as NodeJS.ReadableStream & AsyncIterable<Uint8Array>
    if (!body) throw createHttpError(409, 'Uploaded file is missing. Upload it again.')
    const sha256 = createHash('sha256')
    const md5 = createHash('md5')
    let size = 0
    // Stream to private temporary disk: neither a false Content-Length nor a large
    // object can consume unbounded memory. Only the exact verified bytes are stored.
    await pipeline(
      body,
      async function* (chunks) {
        if (object.ContentLength !== intent.size || object.ContentType !== intent.mime) {
          throw createHttpError(
            400,
            'Uploaded file size or type does not match its upload intent.',
          )
        }
        for await (const chunk of chunks) {
          const bytes = Buffer.from(chunk)
          size += bytes.length
          if (size > intent.size)
            throw createHttpError(400, 'Uploaded file exceeds its declared size.')
          sha256.update(bytes)
          md5.update(bytes)
          yield bytes
        }
      },
      createWriteStream(filename, { mode: 0o600 }),
      { signal },
    )
    if (size !== intent.size || sha256.digest('hex') !== intent.checksum) {
      throw createHttpError(
        400,
        'Uploaded file checksum or size does not match its upload intent.',
      )
    }
    const key = finalObjectKey(intent)
    await storage
      .send(
        new PutObjectCommand({
          Bucket: intent.bucket,
          Key: key,
          Body: createReadStream(filename),
          ContentLength: size,
          ContentType: intent.mime,
          ContentMD5: md5.digest('base64'),
          Metadata: {
            'owner-id': intent.ownerId,
            'upload-id': intent.id,
            sha256: intent.checksum,
          },
          CacheControl: 'private, no-store',
          // Final keys are immutable, including overlapping completion requests.
          IfNoneMatch: '*',
        }),
        { abortSignal: signal },
      )
      .catch((error) => {
        // Only this server can create the final key. The pending bytes were checked
        // against the same signed checksum above; another completion won the write.
        if (error?.$metadata?.httpStatusCode !== 412) throw error
      })
    return key
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) throw error
    throw createHttpError(
      503,
      'File storage could not verify the upload. Please try again.',
    )
  } finally {
    storage.destroy()
    await rm(directory, { recursive: true, force: true })
  }
}

/** Call only after the corresponding file record is durably persisted. */
export async function cleanupR2Upload(intent: UploadIntent): Promise<void> {
  const storage = client()
  try {
    await storage.send(
      new DeleteObjectCommand({ Bucket: intent.bucket, Key: intent.objectKey }),
      { abortSignal: AbortSignal.timeout(10_000) },
    )
  } finally {
    storage.destroy()
  }
}

export async function signR2Download(
  bucket: string,
  objectKey: string,
  mime: string,
): Promise<string> {
  if (bucket !== getR2Settings().bucket || !objectKey.startsWith('uploads/')) {
    throw createHttpError(503, 'This file is not available in the configured storage.')
  }
  const storage = client()
  try {
    return await getSignedUrl(
      storage,
      new GetObjectCommand({
        Bucket: bucket,
        Key: objectKey,
        ResponseContentType: mime,
        ResponseContentDisposition: /^(audio|video|image)\//.test(mime)
          ? 'inline'
          : 'attachment',
        ResponseCacheControl: 'private, no-store',
      }),
      { expiresIn: DOWNLOAD_TTL_SECONDS },
    )
  } finally {
    storage.destroy()
  }
}
