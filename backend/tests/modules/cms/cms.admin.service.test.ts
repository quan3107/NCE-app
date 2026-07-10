/**
 * File: tests/modules/cms/cms.admin.service.test.ts
 * Purpose: Verify CMS draft, publish, revision, and rollback behavior.
 * Why: Admin content changes must remain unpublished until an audited publish action.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const transactionClient = {
  cmsPageContent: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  cmsPageRevision: {
    create: vi.fn(),
    findFirst: vi.fn(),
  },
  cmsSection: {
    deleteMany: vi.fn(),
    create: vi.fn(),
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

const prismaModule = await import('../../../src/prisma/client.js')
const prisma = vi.mocked(prismaModule.prisma, true)
const auditModule = await import('../../../src/modules/audit-logs/audit-logs.service.js')
const writeAuditLogSafely = vi.mocked(auditModule.writeAuditLogSafely)
const { publishCmsDraft, rollbackCmsRevision, updateCmsDraft } =
  await import('../../../src/modules/cms/cms.admin.service.js')

const actor = { id: '15eb1f4b-09a0-48e1-8844-c8f5cf7fa30b' }
const draftContent = {
  hero: {
    badge: 'Draft badge',
    title: 'Draft title',
    description: 'Draft description',
    cta_primary: 'Browse',
    cta_secondary: 'Sign in',
  },
  stats: [],
  howItWorks: {
    title: 'How it works',
    description: 'Draft steps',
    features: [],
  },
}

describe('cms admin service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    transactionClient.cmsSection.deleteMany.mockResolvedValue({ count: 1 })
    transactionClient.cmsSection.create.mockResolvedValue({ id: 'section-1' })
  })

  it('stores an audited draft without replacing published sections', async () => {
    prisma.cmsPageContent.findUnique.mockResolvedValueOnce({
      id: 'page-1',
      pageKey: 'homepage',
      label: 'Homepage',
      draftVersion: 3,
      publishedDraftVersion: 2,
      publishedRevision: 2,
      publishedAt: new Date('2026-07-01T00:00:00.000Z'),
    })
    prisma.cmsPageContent.update.mockResolvedValueOnce({
      id: 'page-1',
      pageKey: 'homepage',
      label: 'Homepage',
      draftContent,
      draftVersion: 4,
      publishedDraftVersion: 2,
      publishedRevision: 2,
      publishedAt: new Date('2026-07-01T00:00:00.000Z'),
      updatedAt: new Date('2026-07-10T00:00:00.000Z'),
    })

    const result = await updateCmsDraft('homepage', draftContent, actor)

    expect(prisma.cmsPageContent.update).toHaveBeenCalledWith({
      where: { id: 'page-1' },
      data: {
        draftContent,
        draftVersion: { increment: 1 },
      },
    })
    expect(transactionClient.cmsSection.deleteMany).not.toHaveBeenCalled()
    expect(result.hasUnpublishedChanges).toBe(true)
    expect(writeAuditLogSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: actor.id,
        action: 'cms.draft_updated',
        entityId: 'page-1',
      }),
    )
  })

  it('publishes the draft as an immutable revision and normalized sections', async () => {
    transactionClient.cmsPageContent.findUnique.mockResolvedValueOnce({
      id: 'page-1',
      pageKey: 'homepage',
      label: 'Homepage',
      draftContent,
      draftVersion: 4,
      publishedDraftVersion: 2,
      publishedRevision: 2,
      publishedAt: new Date('2026-07-01T00:00:00.000Z'),
    })
    transactionClient.cmsPageRevision.create.mockResolvedValueOnce({
      id: 'revision-3',
      revisionNumber: 3,
    })
    transactionClient.cmsPageContent.update.mockResolvedValueOnce({
      id: 'page-1',
      pageKey: 'homepage',
      label: 'Homepage',
      draftContent,
      draftVersion: 4,
      publishedDraftVersion: 4,
      publishedRevision: 3,
      publishedAt: new Date('2026-07-10T00:00:00.000Z'),
      updatedAt: new Date('2026-07-10T00:00:00.000Z'),
    })

    const result = await publishCmsDraft('homepage', actor)

    expect(transactionClient.cmsPageRevision.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        pageId: 'page-1',
        revisionNumber: 3,
        contentJson: draftContent,
        createdById: actor.id,
        operation: 'publish',
      }),
    })
    expect(transactionClient.cmsSection.deleteMany).toHaveBeenCalledWith({
      where: { pageId: 'page-1' },
    })
    expect(result.hasUnpublishedChanges).toBe(false)
    expect(writeAuditLogSafely).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'cms.published', actorId: actor.id }),
    )
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
      contentJson: draftContent,
    })
    transactionClient.cmsPageRevision.create.mockResolvedValueOnce({
      id: 'revision-4',
      revisionNumber: 4,
    })
    transactionClient.cmsPageContent.update.mockResolvedValueOnce({
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

    const result = await rollbackCmsRevision('homepage', 'revision-1', actor)

    expect(transactionClient.cmsPageRevision.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        revisionNumber: 4,
        contentJson: draftContent,
        operation: 'rollback',
        sourceRevisionId: 'revision-1',
      }),
    })
    expect(result.publishedRevision).toBe(4)
    expect(writeAuditLogSafely).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'cms.rolled_back', actorId: actor.id }),
    )
  })
})
