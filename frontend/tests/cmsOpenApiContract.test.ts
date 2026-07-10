/**
 * Location: tests/cmsOpenApiContract.test.ts
 * Purpose: Verify CMS concurrency, validation, and pagination OpenAPI contracts.
 * Why: Admin clients must know which versions and cursors each operation requires.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';

const docsRoot = path.resolve(import.meta.dirname, '../../docs/openapi');

test('CMS OpenAPI documents rollback concurrency and validation responses', async () => {
  const paths = await readFile(path.join(docsRoot, 'paths/cms.yaml'), 'utf8');
  const publish = paths.match(/AdminPagePublish:[\s\S]*?(?=\nAdminPageRevisions:)/)?.[0] ?? '';
  const rollback = paths.match(/AdminPageRollback:[\s\S]*?(?=\nRefreshStats:)/)?.[0] ?? '';

  assert.match(publish, /'400':/);
  assert.match(rollback, /CmsRollbackRequest/);
  assert.match(rollback, /'400':/);
  assert.match(rollback, /'409':/);
});

test('CMS OpenAPI bounds revision history with cursor metadata', async () => {
  const paths = await readFile(path.join(docsRoot, 'paths/cms.yaml'), 'utf8');
  const schemas = await readFile(path.join(docsRoot, 'schemas/cms.yaml'), 'utf8');
  const revisions = paths.match(/AdminPageRevisions:[\s\S]*?(?=\nAdminPageRollback:)/)?.[0] ?? '';
  const response = schemas.match(/CmsRevisionsResponse:[\s\S]*?(?=\nRefreshStatsResponse:)/)?.[0] ?? '';

  assert.match(revisions, /name: limit/);
  assert.match(revisions, /maximum: 100/);
  assert.match(revisions, /name: cursor/);
  assert.match(response, /required: \[revisions, nextCursor\]/);
  assert.match(response, /nextCursor:[\s\S]*nullable: true/);
});

test('CMS rollback schema requires the loaded draft version', async () => {
  const schemas = await readFile(path.join(docsRoot, 'schemas/cms.yaml'), 'utf8');
  const rollback = schemas.match(/CmsRollbackRequest:[\s\S]*?(?=\nCmsRevision:)/)?.[0] ?? '';

  assert.match(rollback, /additionalProperties: false/);
  assert.match(rollback, /required: \[expectedDraftVersion\]/);
  assert.match(rollback, /expectedDraftVersion:[\s\S]*minimum: 0/);
});
