/**
 * Location: modules/submissions/submissions.recording-metadata.ts
 * Purpose: Resolve speaking file details for authorized submission responses.
 * Why: Old and new payloads store IDs, so display metadata must come from owned files.
 */
import path from 'node:path'
import { prisma } from '../../prisma/client.js'

type SubmissionRecord = { studentId: string; payload: unknown }
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export async function withRecordingMetadata<T extends SubmissionRecord>(submissions: T[]): Promise<T[]> {
  const ids = new Set<string>()
  for (const submission of submissions) {
    if (!record(submission.payload) || !Array.isArray(submission.payload.recordings)) continue
    for (const item of submission.payload.recordings) {
      if (record(item) && typeof item.fileId === 'string') ids.add(item.fileId)
    }
  }
  if (!ids.size) return submissions
  const files = await prisma.file.findMany({
    where: { id: { in: [...ids] }, deletedAt: null },
    select: { id: true, ownerId: true, objectKey: true, size: true, mime: true, checksum: true },
  })
  const byId = new Map(files.map(file => [file.id, file]))
  return submissions.map(submission => {
    const payload = submission.payload
    if (!record(payload) || !Array.isArray(payload.recordings)) return submission
    return { ...submission, payload: { ...payload, recordings: payload.recordings.map(item => {
      if (!record(item) || typeof item.fileId !== 'string') return item
      const file = byId.get(item.fileId)
      if (!file || file.ownerId !== submission.studentId) return item
      return { ...item, fileName: path.basename(file.objectKey), size: file.size,
        mime: file.mime, checksum: file.checksum }
    }) } }
  }) as T[]
}
