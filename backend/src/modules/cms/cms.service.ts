/**
 * Location: backend/src/modules/cms/cms.service.ts
 * Purpose: Business logic for CMS/marketing content with real database queries
 * Why: Separates data access from HTTP handling, allows for caching and analytics
 */

import { prisma } from '../../prisma/client.js'
import { writeAuditLogSafely } from '../audit-logs/audit-logs.service.js'
import { parseCmsPageContent } from './cms.content.js'
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
  listCmsRevisions,
  publishCmsDraft,
  rollbackCmsRevision,
  updateCmsDraft,
} from './cms.admin.service.js'

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

export const updateHomepageStatsWithRealtimeData = async (): Promise<void> => {
  const stats = await getRealtimeStats()

  const homepage = await prisma.cmsPageContent.findUnique({
    where: { pageKey: 'homepage' },
    include: {
      sections: {
        where: { sectionKey: 'stats' },
        include: { items: true },
      },
    },
  })

  if (!homepage) return

  const statsSection = homepage.sections[0]
  if (!statsSection) return

  const updatedItems: Array<{
    itemId: string
    itemKey: string | null
    value: {
      from: number
      to: number
    }
  }> = []

  const updatePromises = statsSection.items.map(async (item) => {
    const itemKey = item.itemKey
    const currentContent = item.contentJson as {
      value: number
      label: string
      format: string
      suffix?: string
    }

    let newValue = currentContent.value

    if (itemKey === 'stat_students') {
      newValue = stats.activeStudents
    } else if (itemKey === 'stat_band_score') {
      newValue = stats.avgBandScore
    } else if (itemKey === 'stat_success_rate') {
      newValue = stats.successRate
    }

    if (newValue !== currentContent.value) {
      await prisma.cmsContentItem.update({
        where: { id: item.id },
        data: {
          contentJson: {
            ...currentContent,
            value: newValue,
          },
        },
      })
      updatedItems.push({
        itemId: item.id,
        itemKey,
        value: {
          from: currentContent.value,
          to: newValue,
        },
      })
    }
  })

  await Promise.all(updatePromises)

  if (updatedItems.length > 0) {
    await writeAuditLogSafely({
      actorId: null,
      action: 'cms.homepage_stats_refreshed',
      entity: 'cms_page_content',
      entityId: homepage.id,
      diff: {
        pageKey: 'homepage',
        sectionKey: 'stats',
        updatedItems,
      },
    })
  }
}
