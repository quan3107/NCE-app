/**
 * File: src/modules/audit-logs/contracts/operations.ts
 * Purpose: Define strict CMS, dashboard, and cleanup audit event contracts.
 * Why: Operational history should retain bounded identifiers and counts, never page content.
 */
import { z } from 'zod'

import {
  auditIdSchema,
  auditLabelSchema,
  auditTimestampSchema,
  userRoleSchema,
} from './common.js'

export const operationsAuditContracts = {
  'cms.draft_updated': {
    entity: 'cms_page_content',
    schema: z.strictObject({
      pageKey: auditLabelSchema,
      fromDraftVersion: z.number().int().nonnegative(),
      toDraftVersion: z.number().int().nonnegative(),
      draftContentChanged: z.literal(true),
    }),
  },
  'cms.published': {
    entity: 'cms_page_content',
    schema: z.strictObject({
      pageKey: auditLabelSchema,
      revisionId: auditIdSchema,
      revisionNumber: z.number().int().positive(),
      publishedContentChanged: z.boolean(),
    }),
  },
  'cms.rolled_back': {
    entity: 'cms_page_content',
    schema: z.strictObject({
      pageKey: auditLabelSchema,
      revisionId: auditIdSchema,
      revisionNumber: z.number().int().positive(),
      sourceRevisionId: auditIdSchema,
      sourceRevisionNumber: z.number().int().positive(),
      publishedContentChanged: z.boolean(),
    }),
  },
  'cms.homepage_stats_refreshed': {
    entity: 'cms_page_content',
    schema: z.strictObject({
      pageKey: z.literal('homepage'),
      sectionKey: z.literal('stats'),
      updatedItemCount: z.number().int().nonnegative(),
      draftSynchronized: z.boolean(),
    }),
  },
  'dashboard_config.saved': {
    entity: 'user_dashboard_config',
    schema: z.strictObject({
      role: userRoleSchema,
      widgetCount: z.number().int().nonnegative(),
      visibleCount: z.number().int().nonnegative(),
    }),
  },
  'dashboard_config.reset': {
    entity: 'user_dashboard_config',
    schema: z.strictObject({
      role: userRoleSchema,
      widgetCount: z.number().int().nonnegative(),
    }),
  },
  'cleanup.retention_executed': {
    entity: 'maintenance_job',
    schema: z.strictObject({
      authSessions: z.number().int().nonnegative(),
      notificationMetadata: z.number().int().nonnegative(),
      authSessionBatches: z.number().int().nonnegative(),
      notificationMetadataBatches: z.number().int().nonnegative(),
      batchSize: z.number().int().positive(),
      maxBatches: z.number().int().positive(),
      authSessionBatchLimitReached: z.boolean(),
      notificationMetadataBatchLimitReached: z.boolean(),
      authSessionCutoff: auditTimestampSchema,
      notificationMetadataCutoff: auditTimestampSchema,
    }),
  },
} as const
