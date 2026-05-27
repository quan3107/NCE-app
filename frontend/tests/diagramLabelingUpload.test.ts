import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { UploadFile } from '../src/types/domain';
import {
  createAuthoringUploadFn,
  createDiagramImageUploadFn,
} from '../src/features/assignments/components/ielts/diagramLabelingUpload';

test('diagram image upload adapter preserves UploadFile metadata', async () => {
  const file = new File(['diagram'], 'diagram.png', { type: 'image/png' });
  const uploadedFile: UploadFile = {
    id: 'image-123',
    name: file.name,
    size: file.size,
    mime: file.type,
    url: 'blob:diagram-preview',
    createdAt: '2026-05-27T00:00:00.000Z',
  };
  const stages: string[] = [];
  const progress: number[] = [];

  const uploadFn = createDiagramImageUploadFn(async (input) => {
    assert.equal(input, file);
    return uploadedFile;
  });

  const result = await uploadFn(
    file,
    (value) => progress.push(value),
    (stage) => stages.push(stage),
  );

  assert.deepEqual(result, uploadedFile);
  assert.deepEqual(progress, [100]);
  assert.deepEqual(stages, ['uploading', 'completing']);
});

test('authoring upload helper returns preview metadata keyed by the persisted file id', async () => {
  const file = new File(['audio'], 'section-1.mp3', { type: 'audio/mpeg' });
  const stages: string[] = [];
  const progress: number[] = [];
  const uploadFn = createAuthoringUploadFn({
    uploadFile: async ({ file: input, onProgress, onStageChange }) => {
      assert.equal(input, file);
      onStageChange?.('hashing');
      onProgress(55);
      onStageChange?.('completing');
      return {
        id: 'persisted-file-456',
        name: input.name,
        size: input.size,
        mime: input.type,
        checksum: 'checksum',
        bucket: 'nce',
        objectKey: 'uploads/section-1.mp3',
      };
    },
    createObjectUrl: () => 'blob:audio-preview',
    now: () => '2026-05-27T01:02:03.000Z',
  });

  const result = await uploadFn(
    file,
    (value) => progress.push(value),
    (stage) => stages.push(stage),
  );

  assert.deepEqual(result, {
    id: 'persisted-file-456',
    name: file.name,
    size: file.size,
    mime: file.type,
    url: 'blob:audio-preview',
    createdAt: '2026-05-27T01:02:03.000Z',
  });
  assert.deepEqual(progress, [55]);
  assert.deepEqual(stages, ['hashing', 'completing']);
});
