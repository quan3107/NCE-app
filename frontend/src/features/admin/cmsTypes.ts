/**
 * Location: features/admin/cmsTypes.ts
 * Purpose: Define frontend contracts for CMS admin drafts and revision history.
 * Why: Keeps page-specific content types aligned across API hooks and editor components.
 */
import type {
  CmsAboutPageContent,
  CmsContactPageContent,
  CmsHomepageContent,
} from '@lib/backend-schema';

export type CmsPageKey = 'homepage' | 'about' | 'contact';
export type CmsPageContent =
  | CmsHomepageContent
  | CmsAboutPageContent
  | CmsContactPageContent;

export type CmsPageSummary = {
  pageKey: CmsPageKey;
  label: string;
  draftVersion: number;
  publishedDraftVersion: number;
  publishedRevision: number;
  publishedAt: string | null;
  updatedAt?: string;
  hasUnpublishedChanges: boolean;
};

export type CmsPageState = CmsPageSummary & {
  content: CmsPageContent;
};

export type CmsRevision = {
  id: string;
  revisionNumber: number;
  operation: 'publish' | 'rollback';
  createdAt: string;
  createdBy: { id: string; fullName: string } | null;
  sourceRevision: { id: string; revisionNumber: number } | null;
};

export type CmsPagesResponse = { pages: CmsPageSummary[] };
export type CmsRevisionsResponse = { revisions: CmsRevision[] };
