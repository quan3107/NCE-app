/**
 * File: tests/modules/cms/cms.revisions.service.test.ts
 * Purpose: Verify bounded revision reads and optimistic rollback concurrency.
 * Why: History snapshots are large and rollback must not erase a newer draft.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const transactionClient = {
  $queryRaw: vi.fn(),
  cmsPageContent: {
    findUnique: vi.fn(),
    updateMany: vi.fn(),
  },
  cmsPageDraft: { upsert: vi.fn() },
  cmsPageRevision: {
    create: vi.fn(),
    findFirst: vi.fn(),
  },
  cmsSection: {
    deleteMany: vi.fn(),
    create: vi.fn(),
  },
}

const prismaMock = {
  cmsPageContent: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
  cmsPageRevision: { findMany: vi.fn() },
  $transaction: vi.fn(async (operation: (tx: typeof transactionClient) => unknown) =>
    operation(transactionClient)),
}

vi.mock('../../../src/prisma/client.js', () => ({ prisma: prismaMock }))
vi.mock('../../../src/modules/audit-logs/audit-logs.service.js', () => ({
  writeAuditLogSafely: vi.fn(),
}))

const adminService = await import('../../../src/modules/cms/cms.admin.service.js')
const revisionService = await import('../../../src/modules/cms/cms.revisions.service.js')

const actor = { id: '15eb1f4b-09a0-48e1-8844-c8f5cf7fa30b' }
describe('CMS revision service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    transactionClient.$queryRaw.mockResolvedValue([{ id: 'page-1' }])
    transactionClient.cmsSection.deleteMany.mockResolvedValue({ count: 1 })
    transactionClient.cmsSection.create.mockResolvedValue({ id: 'section-1' })
  })

  it('filters the admin page list to managed page keys', async () => {
    prismaMock.cmsPageContent.findMany.mockResolvedValue([])

    await adminService.listCmsPages()

    expect(prismaMock.cmsPageContent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          isActive: true,
          pageKey: { in: ['homepage', 'about', 'contact'] },
        },
      }),
    )
  })

  it('returns bounded revision metadata with a stable next cursor', async () => {
    prismaMock.cmsPageContent.findUnique.mockResolvedValue({ id: 'page-1' })
    prismaMock.cmsPageRevision.findMany.mockResolvedValue([
      { id: 'revision-3', revisionNumber: 3 },
      { id: 'revision-2', revisionNumber: 2 },
      { id: 'revision-1', revisionNumber: 1 },
    ])

    const result = await revisionService.listCmsRevisions('homepage', { limit: 2 })

    expect(prismaMock.cmsPageRevision.findMany).toHaveBeenCalledWith({
      where: { pageId: 'page-1' },
      orderBy: [{ revisionNumber: 'desc' }, { id: 'desc' }],
      take: 3,
      select: {
        id: true,
        revisionNumber: true,
        operation: true,
        createdAt: true,
        createdBy: { select: { id: true, fullName: true } },
        sourceRevision: { select: { id: true, revisionNumber: true } },
      },
    })
    expect(result).toEqual({
      revisions: [
        { id: 'revision-3', revisionNumber: 3 },
        { id: 'revision-2', revisionNumber: 2 },
      ],
      nextCursor: 'revision-2',
    })
  })

  it('uses the supplied cursor without returning it again', async () => {
    prismaMock.cmsPageContent.findUnique.mockResolvedValue({ id: 'page-1' })
    prismaMock.cmsPageRevision.findMany.mockResolvedValue([])

    await revisionService.listCmsRevisions('homepage', {
      limit: 10,
      cursor: '6db57b0d-34d4-4ed8-a391-d01911dd6e06',
    })

    expect(prismaMock.cmsPageRevision.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        cursor: { id: '6db57b0d-34d4-4ed8-a391-d01911dd6e06' },
        skip: 1,
        take: 11,
      }),
    )
  })

  it('rejects rollback before writes when the loaded draft version is stale', async () => {
    transactionClient.cmsPageContent.findUnique.mockResolvedValue({
      id: 'page-1',
      pageKey: 'homepage',
      label: 'Homepage',
      isActive: true,
      draftVersion: 5,
      publishedDraftVersion: 4,
      publishedRevision: 3,
      publishedAt: new Date(),
    })

    await expect(
      revisionService.rollbackCmsRevision('homepage', 'revision-1', 4, actor),
    ).rejects.toMatchObject({ statusCode: 409 })
    expect(transactionClient.cmsPageRevision.findFirst).not.toHaveBeenCalled()
    expect(transactionClient.cmsPageRevision.create).not.toHaveBeenCalled()
    expect(transactionClient.cmsPageDraft.upsert).not.toHaveBeenCalled()
  })
})
