/**
 * Location: tests/adminCms.mutations.component.test.tsx
 * Purpose: Verify CMS mutations cache authoritative versions before completing refreshes.
 * Why: Save followed quickly by publish must not reuse a stale draft version.
 */
import assert from 'node:assert/strict';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import React, { type PropsWithChildren } from 'react';
import { afterEach, test, vi } from 'vitest';

import { useSaveCmsDraftMutation } from '../src/features/admin/cmsApi';
import { queryClient } from '../src/lib/queryClient';

const originalFetch = globalThis.fetch;

afterEach(() => {
  cleanup();
  queryClient.clear();
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

const wrapper = ({ children }: PropsWithChildren) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

test('save caches the returned version and stays pending through invalidation', async () => {
  const page = {
    pageKey: 'homepage' as const,
    label: 'Homepage',
    content: {
      hero: {
        badge: 'Badge',
        title: 'Saved title',
        description: 'Description',
        cta_primary: 'Browse',
        cta_secondary: 'Sign in',
      },
      stats: [],
      howItWorks: { title: 'How it works', description: 'Steps', features: [] },
    },
    draftVersion: 6,
    publishedDraftVersion: 4,
    publishedRevision: 2,
    publishedAt: '2026-07-01T00:00:00.000Z',
    hasUnpublishedChanges: true,
  };
  globalThis.fetch = vi.fn(async () => new Response(JSON.stringify(page), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  }));
  let releaseInvalidation!: () => void;
  const invalidation = new Promise<void>((resolve) => {
    releaseInvalidation = resolve;
  });
  vi.spyOn(queryClient, 'invalidateQueries').mockReturnValue(invalidation);
  queryClient.setQueryDefaults(['admin', 'cms', 'homepage', 'draft'], {
    gcTime: Number.POSITIVE_INFINITY,
  });
  const { result } = renderHook(() => useSaveCmsDraftMutation(), { wrapper });

  act(() => result.current.mutate({
    pageKey: 'homepage',
    content: page.content,
    expectedDraftVersion: 5,
  }));

  await waitFor(() => {
    assert.equal(
      queryClient.getQueryData<{ draftVersion: number }>([
        'admin', 'cms', 'homepage', 'draft',
      ])?.draftVersion,
      6,
    );
  });
  assert.equal(result.current.isPending, true);

  releaseInvalidation();
  await waitFor(() => assert.equal(result.current.isPending, false));
});
