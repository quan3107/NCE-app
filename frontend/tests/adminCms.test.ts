/// <reference lib="dom" />
/**
 * Location: tests/adminCms.test.ts
 * Purpose: Verify admin CMS request helpers use the draft, publish, and revision API contract.
 * Why: Content management actions must not accidentally call public or destructive endpoints.
 */
import assert from 'node:assert/strict';
import { afterEach, before, test } from 'node:test';

type CmsApi = typeof import('../src/features/admin/cmsApi');
let cmsApi: CmsApi;

const originalFetch = globalThis.fetch;

before(async () => {
  process.env.VITE_API_BASE_URL = 'http://localhost:4000/api/v1';
  cmsApi = await import('../src/features/admin/cmsApi');
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function jsonResponse(payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

test('CMS admin helpers target draft and revision endpoints', async () => {
  const calls: Array<{ url: URL; init?: RequestInit }> = [];
  globalThis.fetch = async (input, init) => {
    calls.push({ url: new URL(String(input)), init });
    if (String(input).endsWith('/revisions')) return jsonResponse({ revisions: [] });
    if (String(input).endsWith('/pages')) return jsonResponse({ pages: [] });
    return jsonResponse({
      pageKey: 'homepage',
      label: 'Homepage',
      content: {},
      draftVersion: 1,
      publishedDraftVersion: 0,
      publishedRevision: 0,
      publishedAt: null,
      hasUnpublishedChanges: true,
    });
  };

  await cmsApi.fetchCmsPages();
  await cmsApi.fetchCmsDraft('homepage');
  await cmsApi.saveCmsDraft({
    pageKey: 'homepage',
    content: { hero: {} } as never,
    expectedDraftVersion: 3,
  });
  await cmsApi.publishCmsDraft({
    pageKey: 'homepage',
    content: { hero: { title: 'Reviewed title' } } as never,
    expectedDraftVersion: 4,
  });
  const revisionId = '6db57b0d-34d4-4ed8-a391-d01911dd6e06';
  await cmsApi.fetchCmsRevisions('homepage', {
    limit: 25,
    cursor: revisionId,
  });
  await cmsApi.rollbackCmsRevision({
    pageKey: 'homepage',
    revisionId,
    expectedDraftVersion: 5,
  });

  assert.deepEqual(
    calls.map(({ url, init }) => [url.pathname, init?.method ?? 'GET']),
    [
      ['/api/v1/cms/admin/pages', 'GET'],
      ['/api/v1/cms/admin/pages/homepage/draft', 'GET'],
      ['/api/v1/cms/admin/pages/homepage/draft', 'PUT'],
      ['/api/v1/cms/admin/pages/homepage/publish', 'POST'],
      ['/api/v1/cms/admin/pages/homepage/revisions', 'GET'],
      [`/api/v1/cms/admin/pages/homepage/revisions/${revisionId}/rollback`, 'POST'],
    ],
  );
  assert.equal(
    calls[2]?.init?.body,
    JSON.stringify({ content: { hero: {} }, expectedDraftVersion: 3 }),
  );
  assert.equal(
    calls[3]?.init?.body,
    JSON.stringify({
      content: { hero: { title: 'Reviewed title' } },
      expectedDraftVersion: 4,
    }),
  );
  assert.equal(calls[4]?.url.search, `?limit=25&cursor=${revisionId}`);
  assert.equal(
    calls[5]?.init?.body,
    JSON.stringify({ expectedDraftVersion: 5 }),
  );
});
