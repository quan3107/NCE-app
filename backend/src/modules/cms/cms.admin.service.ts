/**
 * Location: backend/src/modules/cms/cms.admin.service.ts
 * Purpose: Manage CMS drafts, publish revisions, previews, and rollback operations.
 * Why: Keeps mutable admin workflows separate from public published-content reads.
 */
import { prisma } from '../../prisma/client.js'
import type { Prisma } from '../../prisma/generated.js'
import { createHttpError } from '../../utils/httpError.js'
import { writeAuditLogSafely } from '../audit-logs/audit-logs.service.js'
import {
  parseCmsPageContent,
  validateCmsPageContent,
} from './cms.content.js'
import { lockCmsPageByKey, replacePublishedSections } from './cms.persistence.js'
import { CmsPageKeySchema, type CmsPageContent, type CmsPageKey } from './cms.schema.js'

type CmsActor = { id: string }

type CmsPageStateRecord = {
  id: string
  pageKey: string
  label: string
  draft?: { content: unknown } | null
  draftVersion: number
  publishedDraftVersion: number
  publishedRevision: number
  publishedAt: Date | null
  updatedAt?: Date
}

const publicPageInclude = {
  draft: true,
  sections: {
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' as const },
    include: {
      items: {
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' as const },
      },
    },
  },
}

function pageKeyFrom(value: string): CmsPageKey {
  return CmsPageKeySchema.parse(value)
}

function pageState(record: CmsPageStateRecord, content: CmsPageContent) {
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

function contentFromPage(
  pageKey: CmsPageKey,
  page: CmsPageStateRecord & { sections?: unknown[] },
) {
  if (page.draft) {
    return validateCmsPageContent(pageKey, page.draft.content)
  }
  return parseCmsPageContent(pageKey, {
    sections: (page.sections ?? []) as Parameters<
      typeof parseCmsPageContent
    >[1]['sections'],
  })
}

export async function listCmsPages() {
  const pages = await prisma.cmsPageContent.findMany({
    where: { isActive: true },
    orderBy: { label: 'asc' },
  })
  return {
    pages: pages.map((page) => ({
      pageKey: pageKeyFrom(page.pageKey),
      label: page.label,
      draftVersion: page.draftVersion,
      publishedDraftVersion: page.publishedDraftVersion,
      publishedRevision: page.publishedRevision,
      publishedAt: page.publishedAt,
      updatedAt: page.updatedAt,
      hasUnpublishedChanges: page.draftVersion > page.publishedDraftVersion,
    })),
  }
}

export async function getCmsDraft(pageKeyValue: string) {
  const pageKey = pageKeyFrom(pageKeyValue)
  const page = await prisma.cmsPageContent.findUnique({
    where: { pageKey, isActive: true },
    include: publicPageInclude,
  })
  if (!page) throw createHttpError(404, 'CMS page not found')
  return pageState(page, contentFromPage(pageKey, page))
}

export async function getCmsPreview(pageKey: string) {
  return getCmsDraft(pageKey)
}

export async function updateCmsDraft(
  pageKeyValue: string,
  contentInput: unknown,
  actor: CmsActor,
) {
  const pageKey = pageKeyFrom(pageKeyValue)
  const content = validateCmsPageContent(pageKey, contentInput)
  const result = await prisma.$transaction(async (tx) => {
    const pageId = await lockCmsPageByKey(tx, pageKey)
    if (!pageId) throw createHttpError(404, 'CMS page not found')
    const existing = await tx.cmsPageContent.findUnique({ where: { id: pageId } })
    if (!existing) throw createHttpError(404, 'CMS page not found')
    const updated = await tx.cmsPageContent.update({
      where: { id: existing.id },
      data: { draftVersion: { increment: 1 } },
    })
    await tx.cmsPageDraft.upsert({
      where: { pageId: existing.id },
      create: { pageId: existing.id, content: content as Prisma.InputJsonValue },
      update: { content: content as Prisma.InputJsonValue },
    })
    return { existing, updated }
  })
  await writeAuditLogSafely({
    actorId: actor.id,
    action: 'cms.draft_updated',
    entity: 'cms_page_content',
    entityId: result.existing.id,
    diff: {
      pageKey,
      fromDraftVersion: result.existing.draftVersion,
      toDraftVersion: result.updated.draftVersion,
    },
  })
  return pageState(result.updated, content)
}

export async function publishCmsDraft(
  pageKeyValue: string,
  contentInput: unknown,
  expectedDraftVersion: number,
  actor: CmsActor,
) {
  const pageKey = pageKeyFrom(pageKeyValue)
  const content = validateCmsPageContent(pageKey, contentInput)
  const result = await prisma.$transaction(async (tx) => {
    const pageId = await lockCmsPageByKey(tx, pageKey)
    if (!pageId) throw createHttpError(404, 'CMS page not found')
    const page = await tx.cmsPageContent.findUnique({
      where: { id: pageId },
    })
    if (!page || page.isActive === false) throw createHttpError(404, 'CMS page not found')
    if (page.draftVersion !== expectedDraftVersion) {
      throw createHttpError(409, 'CMS draft changed; reload before publishing')
    }

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
      throw createHttpError(409, 'CMS draft changed; reload before publishing')
    }
    await tx.cmsPageDraft.upsert({
      where: { pageId: page.id },
      create: { pageId: page.id, content: content as Prisma.InputJsonValue },
      update: { content: content as Prisma.InputJsonValue },
    })
    const revision = await tx.cmsPageRevision.create({
      data: {
        pageId: page.id,
        revisionNumber,
        contentJson: content as Prisma.InputJsonValue,
        createdById: actor.id,
        operation: 'publish',
      },
    })
    await replacePublishedSections(tx, page.id, pageKey, content)
    const updated = await tx.cmsPageContent.findUnique({
      where: { id: page.id },
    })
    if (!updated) throw createHttpError(404, 'CMS page not found')
    return { page: updated, content, revisionId: revision.id }
  })

  await writeAuditLogSafely({
    actorId: actor.id,
    action: 'cms.published',
    entity: 'cms_page_content',
    entityId: result.page.id,
    diff: {
      pageKey,
      revisionId: result.revisionId,
      revisionNumber: result.page.publishedRevision,
    },
  })
  return pageState(result.page, result.content)
}

export async function listCmsRevisions(pageKeyValue: string) {
  const pageKey = pageKeyFrom(pageKeyValue)
  const page = await prisma.cmsPageContent.findUnique({ where: { pageKey } })
  if (!page) throw createHttpError(404, 'CMS page not found')
  const revisions = await prisma.cmsPageRevision.findMany({
    where: { pageId: page.id },
    orderBy: { revisionNumber: 'desc' },
    include: {
      createdBy: { select: { id: true, fullName: true } },
      sourceRevision: { select: { id: true, revisionNumber: true } },
    },
  })
  return { revisions }
}

export async function rollbackCmsRevision(
  pageKeyValue: string,
  revisionId: string,
  actor: CmsActor,
) {
  const pageKey = pageKeyFrom(pageKeyValue)
  const result = await prisma.$transaction(async (tx) => {
    const pageId = await lockCmsPageByKey(tx, pageKey)
    if (!pageId) throw createHttpError(404, 'CMS page not found')
    const page = await tx.cmsPageContent.findUnique({
      where: { id: pageId },
    })
    if (!page || page.isActive === false) throw createHttpError(404, 'CMS page not found')
    const source = await tx.cmsPageRevision.findFirst({
      where: { id: revisionId, pageId: page.id },
    })
    if (!source) throw createHttpError(404, 'CMS revision not found')

    const content = validateCmsPageContent(pageKey, source.contentJson)
    const revisionNumber = page.publishedRevision + 1
    const draftVersion = page.draftVersion + 1
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
    const updated = await tx.cmsPageContent.update({
      where: { id: page.id },
      data: {
        draftVersion,
        publishedDraftVersion: draftVersion,
        publishedRevision: revisionNumber,
        publishedAt: new Date(),
      },
    })
    await tx.cmsPageDraft.upsert({
      where: { pageId: page.id },
      create: { pageId: page.id, content: content as Prisma.InputJsonValue },
      update: { content: content as Prisma.InputJsonValue },
    })
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
