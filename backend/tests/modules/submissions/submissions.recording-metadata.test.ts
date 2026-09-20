/**
 * Location: tests/modules/submissions/submissions.recording-metadata.test.ts
 * Purpose: Verify canonical recording metadata and ownership boundaries.
 * Why: Legacy ID-only submissions must recover details without leaking peer files.
 */
import { expect, test, vi } from 'vitest'
vi.mock('../../../src/prisma/client.js', () => ({ prisma: { file: { findMany: vi.fn() } } }))
import { prisma } from '../../../src/prisma/client.js'
import { withRecordingMetadata } from '../../../src/modules/submissions/submissions.recording-metadata.js'

test('hydrates owned records and preserves the original payload', async () => {
  vi.mocked(prisma.file.findMany).mockResolvedValue([
    { id: 'owned', ownerId: 'student', objectKey: 'uploads/owner/recording.wav', size: 32044, mime: 'audio/wav', checksum: 'verified' },
    { id: 'peer', ownerId: 'other', objectKey: 'uploads/private.wav', size: 10, mime: 'audio/wav' },
  ] as never)
  const original = { studentId: 'student', payload: { recordings: [
    { fileId: 'owned', part: 'part1', durationSeconds: 1 }, { fileId: 'peer', part: 'part2' },
  ] } }
  const [result] = await withRecordingMetadata([original])
  expect(result.payload.recordings[0]).toMatchObject({ fileName: 'recording.wav', size: 32044, mime: 'audio/wav' })
  expect(result.payload.recordings[1]).toEqual(original.payload.recordings[1])
  expect(original.payload.recordings[0]).not.toHaveProperty('fileName')
})
