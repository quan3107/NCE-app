/**
 * Location: features/admin/cmsApi.ts
 * Purpose: Provide CMS admin request helpers and React Query mutation hooks.
 * Why: Draft, publish, and rollback operations need one cache-aware API boundary.
 */
import { useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query';

import { apiClient, ApiError } from '@lib/apiClient';
import { queryClient } from '@lib/queryClient';
import type {
  CmsPageContent,
  CmsPageKey,
  CmsPagesResponse,
  CmsPageState,
  CmsRevisionsResponse,
} from './cmsTypes';

const pagesKey = ['admin', 'cms', 'pages'] as const;
const draftKey = (pageKey: CmsPageKey) => ['admin', 'cms', pageKey, 'draft'] as const;
const revisionsKey = (pageKey: CmsPageKey) =>
  ['admin', 'cms', pageKey, 'revisions'] as const;

export const isCmsVersionConflict = (error: unknown) =>
  error instanceof ApiError && error.status === 409;

export const fetchCmsPages = () =>
  apiClient<CmsPagesResponse>('/cms/admin/pages');

export const fetchCmsDraft = (pageKey: CmsPageKey) =>
  apiClient<CmsPageState>(`/cms/admin/pages/${pageKey}/draft`);

export const saveCmsDraft = ({
  pageKey,
  content,
  expectedDraftVersion,
}: {
  pageKey: CmsPageKey;
  content: CmsPageContent;
  expectedDraftVersion: number;
}) =>
  apiClient<CmsPageState, { content: CmsPageContent; expectedDraftVersion: number }>(
    `/cms/admin/pages/${pageKey}/draft`,
    { method: 'PUT', body: { content, expectedDraftVersion } },
  );

export const publishCmsDraft = ({
  pageKey,
  content,
  expectedDraftVersion,
}: {
  pageKey: CmsPageKey;
  content: CmsPageContent;
  expectedDraftVersion: number;
}) =>
  apiClient<
    CmsPageState,
    { content: CmsPageContent; expectedDraftVersion: number }
  >(`/cms/admin/pages/${pageKey}/publish`, {
    method: 'POST',
    body: { content, expectedDraftVersion },
  });

export const fetchCmsRevisions = (
  pageKey: CmsPageKey,
  query: { limit?: number; cursor?: string } = {},
) => {
  const search = new URLSearchParams();
  if (query.limit !== undefined) search.set('limit', String(query.limit));
  if (query.cursor) search.set('cursor', query.cursor);
  const suffix = search.size > 0 ? `?${search.toString()}` : '';
  return apiClient<CmsRevisionsResponse>(
    `/cms/admin/pages/${pageKey}/revisions${suffix}`,
  );
};

export const rollbackCmsRevision = ({
  pageKey,
  revisionId,
  expectedDraftVersion,
}: {
  pageKey: CmsPageKey;
  revisionId: string;
  expectedDraftVersion: number;
}) =>
  apiClient<CmsPageState, { expectedDraftVersion: number }>(
    `/cms/admin/pages/${pageKey}/revisions/${revisionId}/rollback`,
    { method: 'POST', body: { expectedDraftVersion } },
  );

async function refreshPage(
  page: CmsPageState,
  options: { revisions?: boolean; published?: boolean } = {},
) {
  queryClient.setQueryData(draftKey(page.pageKey), page);
  const invalidations = [queryClient.invalidateQueries({ queryKey: pagesKey })];
  if (options.revisions) {
    invalidations.push(
      queryClient.invalidateQueries({ queryKey: revisionsKey(page.pageKey) }),
    );
  }
  if (options.published) {
    invalidations.push(
      queryClient.invalidateQueries({ queryKey: ['cms', page.pageKey] }),
    );
  }
  await Promise.all(invalidations);
}

async function refreshAfterVersionConflict(error: unknown, pageKey: CmsPageKey) {
  if (!isCmsVersionConflict(error)) return;
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: draftKey(pageKey) }),
    queryClient.invalidateQueries({ queryKey: pagesKey }),
  ]);
}

export function useCmsPagesQuery() {
  return useQuery({ queryKey: pagesKey, queryFn: fetchCmsPages });
}

export function useCmsDraftQuery(pageKey: CmsPageKey) {
  return useQuery({ queryKey: draftKey(pageKey), queryFn: () => fetchCmsDraft(pageKey) });
}

export function useCmsRevisionsQuery(pageKey: CmsPageKey) {
  return useInfiniteQuery({
    queryKey: revisionsKey(pageKey),
    queryFn: ({ pageParam }) => fetchCmsRevisions(pageKey, {
      limit: 25,
      cursor: pageParam,
    }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}

export function useSaveCmsDraftMutation() {
  return useMutation({
    mutationFn: saveCmsDraft,
    onSuccess: (page) => refreshPage(page),
    onError: (error, variables) =>
      refreshAfterVersionConflict(error, variables.pageKey),
  });
}

export function usePublishCmsDraftMutation() {
  return useMutation({
    mutationFn: publishCmsDraft,
    onSuccess: (page) => refreshPage(page, { revisions: true, published: true }),
    onError: (error, variables) =>
      refreshAfterVersionConflict(error, variables.pageKey),
  });
}

export function useRollbackCmsRevisionMutation() {
  return useMutation({
    mutationFn: rollbackCmsRevision,
    onSuccess: (page) => refreshPage(page, { revisions: true, published: true }),
    onError: (error, variables) =>
      refreshAfterVersionConflict(error, variables.pageKey),
  });
}
