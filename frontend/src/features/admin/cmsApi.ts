/**
 * Location: features/admin/cmsApi.ts
 * Purpose: Provide CMS admin request helpers and React Query mutation hooks.
 * Why: Draft, publish, and rollback operations need one cache-aware API boundary.
 */
import { useMutation, useQuery } from '@tanstack/react-query';

import { apiClient } from '@lib/apiClient';
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

export const fetchCmsPages = () =>
  apiClient<CmsPagesResponse>('/cms/admin/pages');

export const fetchCmsDraft = (pageKey: CmsPageKey) =>
  apiClient<CmsPageState>(`/cms/admin/pages/${pageKey}/draft`);

export const saveCmsDraft = ({
  pageKey,
  content,
}: {
  pageKey: CmsPageKey;
  content: CmsPageContent;
}) =>
  apiClient<CmsPageState, { content: CmsPageContent }>(
    `/cms/admin/pages/${pageKey}/draft`,
    { method: 'PUT', body: { content } },
  );

export const publishCmsDraft = (pageKey: CmsPageKey) =>
  apiClient<CmsPageState>(`/cms/admin/pages/${pageKey}/publish`, {
    method: 'POST',
  });

export const fetchCmsRevisions = (pageKey: CmsPageKey) =>
  apiClient<CmsRevisionsResponse>(`/cms/admin/pages/${pageKey}/revisions`);

export const rollbackCmsRevision = ({
  pageKey,
  revisionId,
}: {
  pageKey: CmsPageKey;
  revisionId: string;
}) =>
  apiClient<CmsPageState>(
    `/cms/admin/pages/${pageKey}/revisions/${revisionId}/rollback`,
    { method: 'POST' },
  );

function refreshPage(pageKey: CmsPageKey) {
  queryClient.invalidateQueries({ queryKey: pagesKey });
  queryClient.invalidateQueries({ queryKey: draftKey(pageKey) });
  queryClient.invalidateQueries({ queryKey: revisionsKey(pageKey) });
  queryClient.invalidateQueries({ queryKey: ['cms', pageKey] });
}

export function useCmsPagesQuery() {
  return useQuery({ queryKey: pagesKey, queryFn: fetchCmsPages });
}

export function useCmsDraftQuery(pageKey: CmsPageKey) {
  return useQuery({ queryKey: draftKey(pageKey), queryFn: () => fetchCmsDraft(pageKey) });
}

export function useCmsRevisionsQuery(pageKey: CmsPageKey) {
  return useQuery({
    queryKey: revisionsKey(pageKey),
    queryFn: () => fetchCmsRevisions(pageKey),
  });
}

export function useSaveCmsDraftMutation() {
  return useMutation({
    mutationFn: saveCmsDraft,
    onSuccess: (page) => refreshPage(page.pageKey),
  });
}

export function usePublishCmsDraftMutation() {
  return useMutation({
    mutationFn: publishCmsDraft,
    onSuccess: (page) => refreshPage(page.pageKey),
  });
}

export function useRollbackCmsRevisionMutation() {
  return useMutation({
    mutationFn: rollbackCmsRevision,
    onSuccess: (page) => refreshPage(page.pageKey),
  });
}
