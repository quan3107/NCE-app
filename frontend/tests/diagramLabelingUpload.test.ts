import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { UploadFile } from '../src/types/domain';
import { createDiagramImageUploadFn } from '../src/features/assignments/components/ielts/diagramLabelingUpload';

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
