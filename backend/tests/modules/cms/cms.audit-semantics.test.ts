/**
 * File: tests/modules/cms/cms.audit-semantics.test.ts
 * Purpose: Verify CMS publish and rollback semantic audit markers.
 * Why: Revision lifecycle events must distinguish real content changes from normalized no-ops.
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
    findUnique: vi.fn(),
  },
  cmsSection: { upsert: vi.fn() },
  cmsContentItem: {
    findMany: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
    deleteMany: vi.fn(),
  },
}

vi.mock('../../../src/prisma/client.js', () => ({
  prisma: {
    $transaction: vi.fn(async (operation) => operation(transactionClient)),
  },
}))
vi.mock('../../../src/modules/audit-logs/audit-logs.service.js', () => ({
  writeAuditLogSafely: vi.fn(),
}))

const auditModule = await import('../../../src/modules/audit-logs/audit-logs.service.js')
const writeAuditLogSafely = vi.mocked(auditModule.writeAuditLogSafely)
const { publishCmsDraft } = await import('../../../src/modules/cms/cms.admin.service.js')
const { rollbackCmsRevision } =
  await import('../../../src/modules/cms/cms.revisions.service.js')

const actor = { id: '15eb1f4b-09a0-48e1-8844-c8f5cf7fa30b' }
const content = {
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
    {
      itemKey: 'stat_success_rate',
      label: 'Success rate',
      value: 0.8,
      format: 'percentage',
    },
  ],
  howItWorks: {
    title: 'How it works',
    description: 'Draft steps',
    features: [],
  },
}

function pageState(publishedRevision: number, draftVersion: number) {
  return {
    id: 'page-1',
    pageKey: 'homepage',
    label: 'Homepage',
    draftVersion,
    publishedDraftVersion: draftVersion,
    publishedRevision,
    publishedAt: new Date('2026-07-10T00:00:00.000Z'),
    updatedAt: new Date('2026-07-10T00:00:00.000Z'),
  }
}

describe('CMS audit semantic markers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    transactionClient.$queryRaw.mockResolvedValue([{ id: 'page-1' }])
    transactionClient.cmsPageContent.updateMany.mockResolvedValue({ count: 1 })
    transactionClient.cmsPageRevision.findUnique.mockResolvedValue({
      contentJson: content,
    })
    transactionClient.cmsPageRevision.create.mockResolvedValue({
      id: 'revision-new',
    })
    transactionClient.cmsSection.upsert.mockImplementation(async (args) => ({
      id: `section-${args.create.sectionKey}`,
    }))
    transactionClient.cmsContentItem.findMany.mockResolvedValue([])
    transactionClient.cmsContentItem.update.mockResolvedValue({ id: 'item-1' })
    transactionClient.cmsContentItem.create.mockResolvedValue({ id: 'item-1' })
    transactionClient.cmsContentItem.deleteMany.mockResolvedValue({ count: 0 })
  })

  it('marks a semantically unchanged publish as unchanged', async () => {
    transactionClient.cmsPageContent.findUnique
      .mockResolvedValueOnce(pageState(2, 4))
      .mockResolvedValueOnce(pageState(3, 5))

    await publishCmsDraft('homepage', content, 4, actor)

    expect(writeAuditLogSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'cms.published',
        eventData: expect.objectContaining({ publishedContentChanged: false }),
      }),
    )
  })

  it('marks a normalized legacy rollback as unchanged', async () => {
    const legacyContent = {
      ...content,
      stats: content.stats.map(({ itemKey: _itemKey, ...stat }) => stat),
    }
    transactionClient.cmsPageContent.findUnique
      .mockResolvedValueOnce(pageState(3, 4))
      .mockResolvedValueOnce(pageState(4, 5))
    transactionClient.cmsPageRevision.findFirst.mockResolvedValue({
      id: 'revision-1',
      pageId: 'page-1',
      revisionNumber: 1,
      contentJson: legacyContent,
    })

    await rollbackCmsRevision('homepage', 'revision-1', 4, actor)

    expect(writeAuditLogSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'cms.rolled_back',
        eventData: expect.objectContaining({ publishedContentChanged: false }),
      }),
    )
  })
})
