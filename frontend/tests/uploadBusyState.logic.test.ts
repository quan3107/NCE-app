import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  clearBusyUploadScope,
  hasBusyUploads,
  setBusyUploadState,
} from '../src/features/assignments/components/ielts/uploadBusyState.logic';

test('setBusyUploadState tracks and clears uploader keys', () => {
  const afterAudioStart = setBusyUploadState({}, 'section:1:audio', true);
  const afterDiagramStart = setBusyUploadState(afterAudioStart, 'question:2:image:1', true);
  const afterAudioFinish = setBusyUploadState(afterDiagramStart, 'section:1:audio', false);
  const afterDiagramFinish = setBusyUploadState(afterAudioFinish, 'question:2:image:1', false);

  assert.deepEqual(afterAudioStart, { 'section:1:audio': true });
  assert.deepEqual(afterDiagramStart, {
    'question:2:image:1': true,
    'section:1:audio': true,
  });
  assert.deepEqual(afterAudioFinish, { 'question:2:image:1': true });
  assert.deepEqual(afterDiagramFinish, {});
});

test('hasBusyUploads returns true while any uploader is still pending', () => {
  assert.equal(hasBusyUploads({}), false);
  assert.equal(hasBusyUploads({ 'section:1:audio': true }), true);
  assert.equal(
    hasBusyUploads({
      'question:2:image:1': true,
      'section:1:audio': false,
    }),
    true,
  );
});

test('clearBusyUploadScope removes nested uploaders for a deleted section or question', () => {
  const state = {
    'section:1:audio': true,
    'section:1:question:q1:image:slot-1': true,
    'section:2:audio': true,
  };

  assert.deepEqual(clearBusyUploadScope(state, 'section:1:'), {
    'section:2:audio': true,
  });
  assert.equal(clearBusyUploadScope(state, 'section:3:'), state);
});
