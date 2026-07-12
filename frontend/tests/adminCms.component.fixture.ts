/**
 * Location: tests/adminCms.component.fixture.ts
 * Purpose: Provide shared CMS API state and hooks for rendered admin tests.
 * Why: Centralized fixtures keep scenario files below the repository size limit.
 */
import { vi } from 'vitest';

export const saveMutate = vi.fn();
export const publishMutate = vi.fn();
export const rollbackMutate = vi.fn();
export const saveReset = vi.fn();
export const publishReset = vi.fn();
export const rollbackReset = vi.fn();
export const fetchNextPage = vi.fn();
export const cmsState = {
  draftVersion: 1,
  hasUnpublishedChanges: true,
  pagesError: null as Error | null,
  draftError: null as Error | null,
  revisionError: null as Error | null,
  saveError: null as Error | null,
  publishError: null as Error | null,
  rollbackError: null as Error | null,
  hasNextPage: false,
  draftLoading: false,
};

const pages = [
  { pageKey: 'homepage', label: 'Homepage', draftVersion: 1, publishedDraftVersion: 0, publishedRevision: 0, publishedAt: null, hasUnpublishedChanges: true },
  { pageKey: 'about', label: 'About Page', draftVersion: 1, publishedDraftVersion: 1, publishedRevision: 1, publishedAt: null, hasUnpublishedChanges: false },
  { pageKey: 'contact', label: 'Contact Page', draftVersion: 1, publishedDraftVersion: 1, publishedRevision: 0, publishedAt: null, hasUnpublishedChanges: false },
];

const contentFor = (pageKey: string) => pageKey === 'contact'
  ? {
      header: { title: 'Contact us', description: 'Get in touch.' },
      form: { title: 'Message us', description: 'We can help.', submitLabel: 'Send' },
      details: { email: 'support@example.com', phone: '123', address: 'Office' },
      hours: [{ label: 'Weekdays', value: '9 to 5' }],
    }
  : pageKey === 'about'
    ? {
        hero: { title: 'About NCE', description: 'Our teaching mission.' },
        values: [{ icon: 'target', title: 'Student success', description: 'Learners come first.' }],
        story: { sections: ['We started with expert teachers.'] },
      }
    : {
        hero: { badge: 'Badge', title: 'Original title', description: 'Description', cta_primary: 'Browse', cta_secondary: 'Login' },
        stats: [
          { itemKey: 'stat_students', label: 'Learners', value: 42, format: 'number' },
          { itemKey: 'stat_band_score', label: 'Band score', value: 7.5, format: 'decimal' },
          { itemKey: 'stat_success_rate', label: 'Success rate', value: 0.8, format: 'percentage' },
        ],
        howItWorks: { title: 'How it works', description: 'Steps', features: [{ icon: 'book-open', title: 'Practice tasks', description: 'Use real tasks.' }] },
      };

export const isCmsVersionConflict = (error: unknown) =>
  (error as { status?: number } | null)?.status === 409;
export const useCmsPagesQuery = () => ({ data: { pages }, isLoading: false, error: cmsState.pagesError });
export const useCmsDraftQuery = (pageKey: string) => ({
  data: {
    pageKey,
    label: pageKey === 'contact' ? 'Contact Page' : pageKey === 'about' ? 'About Page' : 'Homepage',
    content: contentFor(pageKey),
    draftVersion: cmsState.draftVersion,
    publishedDraftVersion: 0,
    publishedRevision: 0,
    publishedAt: null,
    hasUnpublishedChanges: cmsState.hasUnpublishedChanges,
  },
  isLoading: cmsState.draftLoading,
  error: cmsState.draftError,
});
export const useCmsRevisionsQuery = () => ({
  data: { pages: [{ revisions: [{ id: 'revision-1', revisionNumber: 1, operation: 'publish', createdAt: '2026-07-01T00:00:00.000Z', createdBy: { id: 'admin-1', fullName: 'Admin User' }, sourceRevision: null }], nextCursor: null }] },
  isLoading: false,
  error: cmsState.revisionError,
  hasNextPage: cmsState.hasNextPage,
  isFetchingNextPage: false,
  fetchNextPage,
});
export const useSaveCmsDraftMutation = () => ({ mutate: saveMutate, reset: saveReset, isPending: false, error: cmsState.saveError });
export const usePublishCmsDraftMutation = () => ({ mutate: publishMutate, reset: publishReset, isPending: false, error: cmsState.publishError });
export const useRollbackCmsRevisionMutation = () => ({ mutate: rollbackMutate, reset: rollbackReset, isPending: false, error: cmsState.rollbackError });

export function resetCmsComponentState() {
  cmsState.draftVersion = 1;
  cmsState.hasUnpublishedChanges = true;
  cmsState.pagesError = null;
  cmsState.draftError = null;
  cmsState.revisionError = null;
  cmsState.saveError = null;
  cmsState.publishError = null;
  cmsState.rollbackError = null;
  cmsState.hasNextPage = false;
  cmsState.draftLoading = false;
}
