/**
 * File: tests/modules/cms/cms.service.test.ts
 * Purpose: Verify CMS maintenance mutations emit safe audit entries.
 * Why: Automated content updates still need operational traceability.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const database = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
  cmsPageContent: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  cmsPageDraft: {
    update: vi.fn(),
  },
  cmsContentItem: {
    update: vi.fn(),
  },
}))

vi.mock('../../../src/prisma/client.js', () => ({
  prisma: {
    user: {
      count: vi.fn(),
    },
    submission: {
      count: vi.fn(),
    },
    grade: {
      aggregate: vi.fn(),
    },
    ...database,
    $transaction: vi.fn(async (operation) => operation(database)),
  },
}))

vi.mock('../../../src/modules/audit-logs/audit-logs.service.js', () => ({
  writeAuditLogSafely: vi.fn(),
}))

const prismaModule = await import('../../../src/prisma/client.js')
const prisma = vi.mocked(prismaModule.prisma, true)
const auditLogsModule =
  await import('../../../src/modules/audit-logs/audit-logs.service.js')
const writeAuditLogSafely = vi.mocked(auditLogsModule.writeAuditLogSafely)

const { updateHomepageStatsWithRealtimeData } =
  await import('../../../src/modules/cms/cms.service.js')

describe('cms.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    database.$queryRaw.mockResolvedValue([{ id: 'homepage-1' }])
  })

  it('audits homepage stat refreshes without storing full CMS content', async () => {
    prisma.user.count.mockResolvedValueOnce(42)
    prisma.submission.count.mockResolvedValueOnce(10)
    prisma.submission.count.mockResolvedValueOnce(8)
    prisma.grade.aggregate.mockResolvedValueOnce({
      _avg: { band: 7.25 },
    })
    prisma.cmsPageContent.findUnique.mockResolvedValueOnce({
      id: 'homepage-1',
      draftVersion: 3,
      publishedDraftVersion: 2,
      draft: {
        content: {
          hero: {
            badge: 'Badge',
            title: 'Draft title',
            description: 'Draft description',
            cta_primary: 'Browse',
            cta_secondary: 'Sign in',
          },
          stats: [
            {
              value: 10,
              label: 'Active students',
              format: 'number',
            },
            { value: 7.25, label: 'Band score', format: 'decimal' },
            { value: 0.8, label: 'Success rate', format: 'percentage' },
          ],
          howItWorks: {
            title: 'How it works',
            description: 'Steps',
            features: [],
          },
        },
      },
      sections: [
        {
          id: 'stats-section',
          items: [
            {
              id: 'item-students',
              itemKey: 'stat_students',
              contentJson: {
                value: 10,
                label: 'Active students',
                format: 'number',
              },
            },
            { id: 'item-band', itemKey: 'stat_band_score', contentJson: { value: 7.25, label: 'Band score', format: 'decimal' } },
            { id: 'item-success', itemKey: 'stat_success_rate', contentJson: { value: 0.8, label: 'Success rate', format: 'percentage' } },
          ],
        },
      ],
    })

    await updateHomepageStatsWithRealtimeData({ id: 'admin-1' })

    expect(prisma.cmsContentItem.update).toHaveBeenCalledWith({
      where: { id: 'item-students' },
      data: {
        contentJson: {
          value: 42,
          label: 'Active students',
          format: 'number',
        },
      },
    })
    expect(prisma.cmsPageDraft.update).toHaveBeenCalledWith({
      where: { pageId: 'homepage-1' },
      data: {
        content: expect.objectContaining({
          stats: [
            {
              itemKey: 'stat_students',
              value: 42,
              label: 'Active students',
              format: 'number',
            },
            { itemKey: 'stat_band_score', value: 7.25, label: 'Band score', format: 'decimal' },
            { itemKey: 'stat_success_rate', value: 0.8, label: 'Success rate', format: 'percentage' },
          ],
        }),
      },
    })
    expect(prisma.cmsPageContent.update).toHaveBeenCalledWith({
      where: { id: 'homepage-1' },
      data: { draftVersion: 4 },
    })
    expect(prisma.$queryRaw).toHaveBeenCalledOnce()
    expect(prisma.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      prisma.cmsContentItem.update.mock.invocationCallOrder[0] ?? 0,
    )
    expect(writeAuditLogSafely).toHaveBeenCalledWith({
      actorId: 'admin-1',
      action: 'cms.homepage_stats_refreshed',
      entity: 'cms_page_content',
      entityId: 'homepage-1',
      diff: {
        pageKey: 'homepage',
        sectionKey: 'stats',
        draftSynchronized: true,
        updatedItems: [
          {
            itemId: 'item-students',
            itemKey: 'stat_students',
            value: {
              from: 10,
              to: 42,
            },
          },
        ],
      },
    })
    expect(JSON.stringify(writeAuditLogSafely.mock.calls)).not.toContain(
      'Active students',
    )
  })

  it('refreshes reordered draft stats by their published item keys', async () => {
    prisma.user.count.mockResolvedValueOnce(42)
    prisma.submission.count.mockResolvedValueOnce(10)
    prisma.submission.count.mockResolvedValueOnce(8)
    prisma.grade.aggregate.mockResolvedValueOnce({ _avg: { band: 7.25 } })
    prisma.cmsPageContent.findUnique.mockResolvedValueOnce({
      id: 'homepage-1',
      draftVersion: 3,
      publishedDraftVersion: 2,
      draft: {
        content: {
          hero: {
            badge: 'Badge', title: 'Title', description: 'Description',
            cta_primary: 'Browse', cta_secondary: 'Sign in',
          },
          stats: [
            { itemKey: 'stat_success_rate', value: 0.1, label: 'Success rate', format: 'percentage' },
            { itemKey: 'stat_students', value: 10, label: 'Active students', format: 'number' },
            { itemKey: 'stat_band_score', value: 6.5, label: 'Band score', format: 'decimal' },
          ],
          howItWorks: { title: 'How it works', description: 'Steps', features: [] },
        },
      },
      sections: [{
        id: 'stats-section',
        items: [
          { id: 'success', itemKey: 'stat_success_rate', contentJson: { value: 0.1, label: 'Success rate', format: 'percentage' } },
          { id: 'custom', itemKey: 'custom_stat', contentJson: { value: 99, label: 'Custom stat', format: 'number' } },
          { id: 'students', itemKey: 'stat_students', contentJson: { value: 10, label: 'Active students', format: 'number' } },
          { id: 'inactive', itemKey: 'stat_band_score', isActive: false, contentJson: { value: 1, label: 'Old band', format: 'decimal' } },
          { id: 'band', itemKey: 'stat_band_score', contentJson: { value: 6.5, label: 'Band score', format: 'decimal' } },
        ],
      }],
    })

    await updateHomepageStatsWithRealtimeData()

    expect(prisma.cmsPageDraft.update).toHaveBeenCalledWith({
      where: { pageId: 'homepage-1' },
      data: {
        content: expect.objectContaining({
          stats: [
            { itemKey: 'stat_success_rate', value: 0.8, label: 'Success rate', format: 'percentage' },
            { itemKey: 'stat_students', value: 42, label: 'Active students', format: 'number' },
            { itemKey: 'stat_band_score', value: 7.25, label: 'Band score', format: 'decimal' },
          ],
        }),
      },
    })
    expect(prisma.cmsContentItem.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'inactive' } }),
    )
    expect(prisma.cmsContentItem.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'custom' } }),
    )
  })

  it('advances concurrency versions when refreshing without a draft row', async () => {
    prisma.user.count.mockResolvedValueOnce(42)
    prisma.submission.count.mockResolvedValueOnce(10)
    prisma.submission.count.mockResolvedValueOnce(8)
    prisma.grade.aggregate.mockResolvedValueOnce({ _avg: { band: 7.25 } })
    prisma.cmsPageContent.findUnique.mockResolvedValueOnce({
      id: 'homepage-1',
      draftVersion: 0,
      publishedDraftVersion: 0,
      draft: null,
      sections: [
        {
          id: 'stats-section',
          items: [
            {
              id: 'students',
              itemKey: 'stat_students',
              contentJson: {
                value: 10,
                label: 'Active students',
                format: 'number',
              },
            },
          ],
        },
      ],
    })

    await updateHomepageStatsWithRealtimeData()

    expect(prisma.cmsPageDraft.update).not.toHaveBeenCalled()
    expect(prisma.cmsPageContent.update).toHaveBeenCalledWith({
      where: { id: 'homepage-1' },
      data: { draftVersion: 1, publishedDraftVersion: 1 },
    })
  })
})
