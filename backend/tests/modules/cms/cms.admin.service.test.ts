/**
 * File: tests/modules/cms/cms.admin.service.test.ts
 * Purpose: Verify CMS draft, publish, revision, and rollback behavior.
 * Why: Admin content changes must remain unpublished until an audited publish action.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
const transactionClient = {
  $queryRaw: vi.fn(),
  cmsPageContent: {
    findUnique: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  cmsPageDraft: { upsert: vi.fn() },
  cmsPageRevision: {
    create: vi.fn(),
    findFirst: vi.fn(),
  },
  cmsSection: { deleteMany: vi.fn(), upsert: vi.fn() },
  cmsContentItem: {
    findMany: vi.fn(), update: vi.fn(), create: vi.fn(), deleteMany: vi.fn(),
  },
}
vi.mock('../../../src/prisma/client.js', () => ({
  prisma: {
    cmsPageContent: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    cmsPageRevision: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    $transaction: vi.fn(async (operation) => operation(transactionClient)),
  },
}))
vi.mock('../../../src/modules/audit-logs/audit-logs.service.js', () => ({
  writeAuditLogSafely: vi.fn(),
}))

const auditModule = await import('../../../src/modules/audit-logs/audit-logs.service.js')
const writeAuditLogSafely = vi.mocked(auditModule.writeAuditLogSafely)
const { publishCmsDraft, updateCmsDraft } =
  await import('../../../src/modules/cms/cms.admin.service.js')
const { rollbackCmsRevision } =
  await import('../../../src/modules/cms/cms.revisions.service.js')

const actor = { id: '15eb1f4b-09a0-48e1-8844-c8f5cf7fa30b' }
const draftContent = {
  hero: {
    badge: 'Draft badge',
    title: 'Draft title',
    description: 'Draft description',
    cta_primary: 'Browse',
    cta_secondary: 'Sign in',
  },
  stats: [
    { itemKey: 'stat_students', label: 'Students', value: 10, format: 'number' },
    { itemKey: 'stat_band_score', label: 'Band score', value: 7.5, format: 'decimal' },
    { itemKey: 'stat_success_rate', label: 'Success rate', value: 0.8, format: 'percentage' },
  ],
  howItWorks: {
    title: 'How it works',
    description: 'Draft steps',
    features: [],
  },
}
const legacyDraftContent = {
  ...draftContent,
  stats: draftContent.stats.map(({ itemKey: _itemKey, ...stat }) => stat),
}

describe('cms admin service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    transactionClient.$queryRaw.mockResolvedValue([{ id: 'page-1' }])
    transactionClient.cmsSection.deleteMany.mockResolvedValue({ count: 1 })
    transactionClient.cmsSection.upsert.mockImplementation(async (args) => ({
      id: `section-${args.create.sectionKey}`,
    }))
    transactionClient.cmsContentItem.findMany.mockResolvedValue([])
    transactionClient.cmsContentItem.update.mockResolvedValue({ id: 'item-1' })
    transactionClient.cmsContentItem.create.mockResolvedValue({ id: 'item-1' })
    transactionClient.cmsContentItem.deleteMany.mockResolvedValue({ count: 0 })
  })

  it('stores an audited draft without replacing published sections', async () => {
    transactionClient.cmsPageContent.findUnique.mockResolvedValueOnce({
      id: 'page-1',
      pageKey: 'homepage',
      label: 'Homepage',
      draft: {
        content: {
          ...draftContent,
          hero: { ...draftContent.hero, title: 'Previous draft title' },
        },
      },
      sections: [],
      draftVersion: 3,
      publishedDraftVersion: 2,
      publishedRevision: 2,
      publishedAt: new Date('2026-07-01T00:00:00.000Z'),
    })
    transactionClient.cmsPageContent.update.mockResolvedValueOnce({
      id: 'page-1',
      pageKey: 'homepage',
      label: 'Homepage',
      draftVersion: 4,
      publishedDraftVersion: 2,
      publishedRevision: 2,
      publishedAt: new Date('2026-07-01T00:00:00.000Z'),
      updatedAt: new Date('2026-07-10T00:00:00.000Z'),
    })

    const result = await updateCmsDraft('homepage', draftContent, 3, actor)

    expect(transactionClient.cmsPageDraft.upsert).toHaveBeenCalledWith({
      where: { pageId: 'page-1' },
      create: { pageId: 'page-1', content: draftContent },
      update: { content: draftContent },
    })
    expect(transactionClient.cmsPageContent.update).toHaveBeenCalledWith({
      where: { id: 'page-1' },
      data: {
        draftVersion: { increment: 1 },
      },
    })
    expect(transactionClient.cmsSection.deleteMany).not.toHaveBeenCalled()
    expect(transactionClient.cmsPageContent.update.mock.invocationCallOrder[0]).toBeLessThan(
      transactionClient.cmsPageDraft.upsert.mock.invocationCallOrder[0] ?? 0,
    )
    expect(result.hasUnpublishedChanges).toBe(true)
    expect(writeAuditLogSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: actor.id,
        action: 'cms.draft_updated',
        entityId: 'page-1',
      }),
    )
  })

  it('rejects saving when the loaded draft version is stale', async () => {
    transactionClient.cmsPageContent.findUnique.mockResolvedValueOnce({
      id: 'page-1',
      pageKey: 'homepage',
      label: 'Homepage',
      draftVersion: 4,
      publishedDraftVersion: 2,
      publishedRevision: 2,
      publishedAt: new Date('2026-07-01T00:00:00.000Z'),
    })

    await expect(
      updateCmsDraft('homepage', draftContent, 3, actor),
    ).rejects.toMatchObject({ statusCode: 409 })
    expect(transactionClient.cmsPageContent.update).not.toHaveBeenCalled()
    expect(transactionClient.cmsPageDraft.upsert).not.toHaveBeenCalled()
  })

  it('publishes the draft as an immutable revision and normalized sections', async () => {
    transactionClient.cmsContentItem.findMany.mockImplementation(async ({ where }) =>
      where.sectionId === 'section-stats'
        ? [
            { id: 'obsolete-managed', itemKey: 'stat_4', isActive: true },
            { id: 'custom-active', itemKey: 'custom_stat', isActive: true },
            { id: 'inactive-managed', itemKey: 'stat_5', isActive: false },
          ]
        : [],
    )
    transactionClient.cmsPageContent.findUnique.mockResolvedValueOnce({
      id: 'page-1',
      pageKey: 'homepage',
      label: 'Homepage',
      draftVersion: 4,
      publishedDraftVersion: 2,
      publishedRevision: 2,
      publishedAt: new Date('2026-07-01T00:00:00.000Z'),
    })
    transactionClient.cmsPageRevision.create.mockResolvedValueOnce({
      id: 'revision-3',
      revisionNumber: 3,
    })
    transactionClient.cmsPageContent.updateMany.mockResolvedValueOnce({ count: 1 })
    transactionClient.cmsPageContent.findUnique.mockResolvedValueOnce({
      id: 'page-1',
      pageKey: 'homepage',
      label: 'Homepage',
      draft: { content: draftContent },
      draftVersion: 5,
      publishedDraftVersion: 5,
      publishedRevision: 3,
      publishedAt: new Date('2026-07-10T00:00:00.000Z'),
      updatedAt: new Date('2026-07-10T00:00:00.000Z'),
    })

    const result = await publishCmsDraft('homepage', draftContent, 4, actor)

    expect(transactionClient.cmsPageRevision.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        pageId: 'page-1',
        revisionNumber: 3,
        contentJson: draftContent,
        createdById: actor.id,
        operation: 'publish',
      }),
    })
    expect(transactionClient.cmsSection.deleteMany).not.toHaveBeenCalled()
    expect(transactionClient.cmsContentItem.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['obsolete-managed'] } },
    })
    expect(transactionClient.cmsPageDraft.upsert).toHaveBeenCalledWith({
      where: { pageId: 'page-1' },
      create: { pageId: 'page-1', content: draftContent },
      update: { content: draftContent },
    })
    expect(transactionClient.cmsPageContent.updateMany).toHaveBeenCalledWith({
      where: { id: 'page-1', draftVersion: 4 },
      data: expect.objectContaining({
        draftVersion: 5,
        publishedDraftVersion: 5,
        publishedRevision: 3,
      }),
    })
    expect(result.hasUnpublishedChanges).toBe(false)
    expect(writeAuditLogSafely).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'cms.published', actorId: actor.id }),
    )
  })

  it('rejects publishing when the reviewed draft version is stale', async () => {
    transactionClient.cmsPageContent.findUnique.mockResolvedValueOnce({
      id: 'page-1',
      pageKey: 'homepage',
      label: 'Homepage',
      draftVersion: 5,
      publishedDraftVersion: 2,
      publishedRevision: 2,
      publishedAt: new Date('2026-07-01T00:00:00.000Z'),
    })

    await expect(
      publishCmsDraft('homepage', draftContent, 4, actor),
    ).rejects.toMatchObject({ statusCode: 409 })
    expect(transactionClient.cmsPageRevision.create).not.toHaveBeenCalled()
    expect(transactionClient.cmsSection.deleteMany).not.toHaveBeenCalled()
    expect(transactionClient.cmsPageDraft.upsert).not.toHaveBeenCalled()
  })

  it('rolls back by publishing a new revision copied from history', async () => {
    transactionClient.cmsPageContent.findUnique.mockResolvedValueOnce({
      id: 'page-1',
      pageKey: 'homepage',
      label: 'Homepage',
      draftVersion: 4,
      publishedDraftVersion: 4,
      publishedRevision: 3,
      publishedAt: new Date('2026-07-10T00:00:00.000Z'),
    })
    transactionClient.cmsPageRevision.findFirst.mockResolvedValueOnce({
      id: 'revision-1',
      pageId: 'page-1',
      revisionNumber: 1,
      contentJson: legacyDraftContent,
    })
    transactionClient.cmsPageRevision.create.mockResolvedValueOnce({
      id: 'revision-4',
      revisionNumber: 4,
    })
    transactionClient.cmsPageContent.updateMany.mockResolvedValueOnce({ count: 1 })
    transactionClient.cmsPageContent.findUnique.mockResolvedValueOnce({
      id: 'page-1',
      pageKey: 'homepage',
      label: 'Homepage',
      draftContent,
      draftVersion: 5,
      publishedDraftVersion: 5,
      publishedRevision: 4,
      publishedAt: new Date('2026-07-10T01:00:00.000Z'),
      updatedAt: new Date('2026-07-10T01:00:00.000Z'),
    })

    const result = await rollbackCmsRevision('homepage', 'revision-1', 4, actor)

    expect(transactionClient.cmsPageRevision.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        revisionNumber: 4,
        contentJson: draftContent,
        operation: 'rollback',
        sourceRevisionId: 'revision-1',
      }),
    })
    expect(result.publishedRevision).toBe(4)
    expect(transactionClient.cmsPageContent.updateMany.mock.invocationCallOrder[0]).toBeLessThan(
      transactionClient.cmsPageDraft.upsert.mock.invocationCallOrder[0] ?? 0,
    )
    expect(writeAuditLogSafely).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'cms.rolled_back', actorId: actor.id }),
    )
  })
})
