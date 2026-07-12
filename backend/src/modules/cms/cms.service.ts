/**
 * Location: backend/src/modules/cms/cms.service.ts
 * Purpose: Business logic for CMS/marketing content with real database queries
 * Why: Separates data access from HTTP handling, allows for caching and analytics
 */

import { prisma } from '../../prisma/client.js'
import type { Prisma } from '../../prisma/generated.js'
import { writeAuditLogSafely } from '../audit-logs/audit-logs.service.js'
import { parseCmsPageContent, validateStoredCmsPageContent } from './cms.content.js'
import { lockCmsPageByKey } from './cms.persistence.js'
import type {
  AboutPageContent,
  ContactPageContent,
  HomepageContent,
  CmsPageKey,
} from './cms.schema.js'

export {
  getCmsDraft,
  getCmsPreview,
  listCmsPages,
  publishCmsDraft,
  updateCmsDraft,
} from './cms.admin.service.js'
export { listCmsRevisions, rollbackCmsRevision } from './cms.revisions.service.js'

// ============================================================================
// Database Queries
// ============================================================================

async function getPublishedPage(pageKey: CmsPageKey) {
  const page = await prisma.cmsPageContent.findUnique({
    where: { pageKey, isActive: true },
    include: {
      sections: {
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
        include: {
          items: {
            where: { isActive: true },
            orderBy: { sortOrder: 'asc' },
          },
        },
      },
    },
  })

  if (!page) {
    throw new Error(`${pageKey} content not found`)
  }

  return parseCmsPageContent(pageKey, page)
}

export const getHomepageContent = async (): Promise<HomepageContent> =>
  getPublishedPage('homepage') as Promise<HomepageContent>

export const getAboutPageContent = async (): Promise<AboutPageContent> =>
  getPublishedPage('about') as Promise<AboutPageContent>

export const getContactPageContent = async (): Promise<ContactPageContent> =>
  getPublishedPage('contact') as Promise<ContactPageContent>

export const getRealtimeStats = async () => {
  const [activeStudents, totalSubmissions, gradedSubmissions] = await Promise.all([
    prisma.user.count({ where: { status: 'active', role: 'student' } }),
    prisma.submission.count(),
    prisma.submission.count({ where: { status: 'graded' } }),
  ])

  const successRate = totalSubmissions > 0 ? gradedSubmissions / totalSubmissions : 0

  const avgBandScore = await prisma.grade
    .aggregate({
      where: {
        band: { not: null },
      },
      _avg: {
        band: true,
      },
    })
    .then((result) => (result._avg?.band ? Number(result._avg.band) : 7.5))

  return {
    activeStudents,
    avgBandScore,
    successRate,
  }
}

export const updateHomepageStatsWithRealtimeData = async (actor?: {
  id: string
}): Promise<void> => {
  const stats = await getRealtimeStats()
  const result = await prisma.$transaction(async (tx) => {
    const pageId = await lockCmsPageByKey(tx, 'homepage')
    if (!pageId) return null
    const homepage = await tx.cmsPageContent.findUnique({
      where: { id: pageId },
      include: {
        draft: true,
        sections: {
          where: { sectionKey: 'stats' },
          include: {
            items: {
              where: { isActive: true },
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
      },
    })
    const statsSection = homepage?.sections[0]
    if (!homepage || !statsSection) return null

    const updatedItems: Array<{
      itemId: string
      itemKey: string | null
      value: { from: number; to: number }
    }> = []
    const valueByKey = new Map<string, number>([
      ['stat_students', stats.activeStudents],
      ['stat_band_score', stats.avgBandScore],
      ['stat_success_rate', stats.successRate],
    ])
    const draftContent = homepage.draft
      ? (validateStoredCmsPageContent('homepage', homepage.draft.content) as HomepageContent)
      : null
    const draftStats = draftContent?.stats.map((item) => ({
      ...item,
      value: valueByKey.get(item.itemKey) ?? item.value,
    }))
    const draftChanged = Boolean(
      draftContent && JSON.stringify(draftStats) !== JSON.stringify(draftContent.stats),
    )

    for (const item of statsSection.items) {
      if (item.isActive === false) continue
      const itemKey = item.itemKey
      const currentContent = item.contentJson as {
        value: number
        label: string
        format: string
        suffix?: string
      }
      const newValue = itemKey
        ? (valueByKey.get(itemKey) ?? currentContent.value)
        : currentContent.value
      if (newValue === currentContent.value) continue

      await tx.cmsContentItem.update({
        where: { id: item.id },
        data: { contentJson: { ...currentContent, value: newValue } },
      })
      updatedItems.push({
        itemId: item.id,
        itemKey,
        value: { from: currentContent.value, to: newValue },
      })
    }

    if (draftContent && draftStats && draftChanged) {
      await tx.cmsPageDraft.update({
        where: { pageId: homepage.id },
        data: {
          content: { ...draftContent, stats: draftStats } as Prisma.InputJsonValue,
        },
      })
    }
    if (updatedItems.length > 0 || draftChanged) {
      const draftVersion = homepage.draftVersion + 1
      await tx.cmsPageContent.update({
        where: { id: homepage.id },
        data:
          homepage.draftVersion === homepage.publishedDraftVersion
            ? { draftVersion, publishedDraftVersion: draftVersion }
            : { draftVersion },
      })
    }
    return { homepageId: homepage.id, updatedItems, draftChanged }
  })

  if (result && (result.updatedItems.length > 0 || result.draftChanged)) {
    await writeAuditLogSafely({
      actorId: actor?.id ?? null,
      action: 'cms.homepage_stats_refreshed',
      entity: 'cms_page_content',
      entityId: result.homepageId,
      diff: {
        pageKey: 'homepage',
        sectionKey: 'stats',
        updatedItems: result.updatedItems,
        draftSynchronized: result.draftChanged,
      },
    })
  }
}
