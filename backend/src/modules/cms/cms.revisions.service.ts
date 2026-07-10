/**
 * Location: backend/src/modules/cms/cms.revisions.service.ts
 * Purpose: List bounded CMS revision metadata and publish historical rollbacks.
 * Why: Revision snapshots are large and rollback needs its own concurrency boundary.
 */
import { prisma } from '../../prisma/client.js'
import type { Prisma } from '../../prisma/generated.js'
import { createHttpError } from '../../utils/httpError.js'
import { writeAuditLogSafely } from '../audit-logs/audit-logs.service.js'
import { validateCmsPageContent } from './cms.content.js'
import { lockCmsPageByKey, replacePublishedSections } from './cms.persistence.js'
import {
  CmsPageKeySchema,
  CmsRevisionQuerySchema,
  type CmsPageContent,
  type CmsPageKey,
} from './cms.schema.js'

type CmsActor = { id: string }
type PageStateRecord = {
  id: string
  pageKey: string
  label: string
  draftVersion: number
  publishedDraftVersion: number
  publishedRevision: number
  publishedAt: Date | null
  updatedAt?: Date
}

export const DEFAULT_CMS_REVISION_LIMIT = 50

function pageKeyFrom(value: string): CmsPageKey {
  return CmsPageKeySchema.parse(value)
}

function pageState(record: PageStateRecord, content: CmsPageContent) {
  return {
    pageKey: pageKeyFrom(record.pageKey),
    label: record.label,
    content,
    draftVersion: record.draftVersion,
    publishedDraftVersion: record.publishedDraftVersion,
    publishedRevision: record.publishedRevision,
    publishedAt: record.publishedAt,
    updatedAt: record.updatedAt,
    hasUnpublishedChanges: record.draftVersion > record.publishedDraftVersion,
  }
}

export async function listCmsRevisions(pageKeyValue: string, queryInput: unknown = {}) {
  const pageKey = pageKeyFrom(pageKeyValue)
  const { limit: requestedLimit, cursor } = CmsRevisionQuerySchema.parse(queryInput)
  const limit = requestedLimit ?? DEFAULT_CMS_REVISION_LIMIT
  const page = await prisma.cmsPageContent.findUnique({ where: { pageKey } })
  if (!page) throw createHttpError(404, 'CMS page not found')
  const rows = await prisma.cmsPageRevision.findMany({
    where: { pageId: page.id },
    orderBy: [{ revisionNumber: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      revisionNumber: true,
      operation: true,
      createdAt: true,
      createdBy: { select: { id: true, fullName: true } },
      sourceRevision: { select: { id: true, revisionNumber: true } },
    },
  })
  const hasMore = rows.length > limit
  const revisions = hasMore ? rows.slice(0, limit) : rows
  return {
    revisions,
    nextCursor: hasMore ? (revisions.at(-1)?.id ?? null) : null,
  }
}

export async function rollbackCmsRevision(
  pageKeyValue: string,
  revisionId: string,
  expectedDraftVersion: number,
  actor: CmsActor,
) {
  const pageKey = pageKeyFrom(pageKeyValue)
  const result = await prisma.$transaction(async (tx) => {
    const pageId = await lockCmsPageByKey(tx, pageKey)
    if (!pageId) throw createHttpError(404, 'CMS page not found')
    const page = await tx.cmsPageContent.findUnique({ where: { id: pageId } })
    if (!page || page.isActive === false) throw createHttpError(404, 'CMS page not found')
    if (page.draftVersion !== expectedDraftVersion) {
      throw createHttpError(409, 'CMS draft changed; reload before rolling back')
    }
    const source = await tx.cmsPageRevision.findFirst({
      where: { id: revisionId, pageId: page.id },
    })
    if (!source) throw createHttpError(404, 'CMS revision not found')

    const content = validateCmsPageContent(pageKey, source.contentJson)
    const revisionNumber = page.publishedRevision + 1
    const draftVersion = page.draftVersion + 1
    const claimed = await tx.cmsPageContent.updateMany({
      where: { id: page.id, draftVersion: expectedDraftVersion },
      data: {
        draftVersion,
        publishedDraftVersion: draftVersion,
        publishedRevision: revisionNumber,
        publishedAt: new Date(),
      },
    })
    if (claimed.count !== 1) {
      throw createHttpError(409, 'CMS draft changed; reload before rolling back')
    }
    const revision = await tx.cmsPageRevision.create({
      data: {
        pageId: page.id,
        revisionNumber,
        contentJson: content as Prisma.InputJsonValue,
        createdById: actor.id,
        operation: 'rollback',
        sourceRevisionId: source.id,
      },
    })
    await replacePublishedSections(tx, page.id, pageKey, content)
    await tx.cmsPageDraft.upsert({
      where: { pageId: page.id },
      create: { pageId: page.id, content: content as Prisma.InputJsonValue },
      update: { content: content as Prisma.InputJsonValue },
    })
    const updated = await tx.cmsPageContent.findUnique({ where: { id: page.id } })
    if (!updated) throw createHttpError(404, 'CMS page not found')
    return { page: updated, content, revisionId: revision.id, source }
  })

  await writeAuditLogSafely({
    actorId: actor.id,
    action: 'cms.rolled_back',
    entity: 'cms_page_content',
    entityId: result.page.id,
    diff: {
      pageKey,
      revisionId: result.revisionId,
      revisionNumber: result.page.publishedRevision,
      sourceRevisionId: result.source.id,
      sourceRevisionNumber: result.source.revisionNumber,
    },
  })
  return pageState(result.page, result.content)
}
