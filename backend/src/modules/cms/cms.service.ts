/**
 * Location: backend/src/modules/cms/cms.service.ts
 * Purpose: Business logic for CMS/marketing content with real database queries
 * Why: Separates data access from HTTP handling, allows for caching and analytics
 */

import { prisma } from '../../prisma/client.js'
import {
  HeroContentSchema,
  StatItemSchema,
  FeatureItemSchema,
  HowItWorksMetaSchema,
  AboutHeroContentSchema,
  ValueItemSchema,
  StoryParagraphSchema,
} from './cms.schema.js'

import type {
  HeroContent,
  StatItem,
  FeatureItem,
  HowItWorksContent,
  ValueItem,
  HomepageContent,
  AboutPageContent,
} from './cms.schema.js'

// ============================================================================
// Database Queries
// ============================================================================

const FALLBACK_HOW_IT_WORKS_TITLE = 'How It Works'
const FALLBACK_HOW_IT_WORKS_DESCRIPTION =
  'Our structured approach helps you improve systematically across all IELTS test components with expert guidance every step of the way.'

export const getHomepageContent = async (): Promise<HomepageContent> => {
  const page = await prisma.cmsPageContent.findUnique({
    where: { pageKey: 'homepage', isActive: true },
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
    throw new Error('Homepage content not found')
  }

  const heroSection = page.sections.find((s) => s.sectionKey === 'hero')
  const statsSection = page.sections.find((s) => s.sectionKey === 'stats')
  const featuresSection = page.sections.find((s) => s.sectionKey === 'features')

  const heroItem = heroSection?.items[0]
  if (!heroItem) {
    throw new Error('Hero content not found')
  }
  const hero = HeroContentSchema.parse(heroItem.contentJson)

  const stats: StatItem[] = (statsSection?.items || []).map((item) =>
    StatItemSchema.parse(item.contentJson),
  )

  const featureItems = (featuresSection?.items || []).filter(
    (item) => item.contentType === 'feature',
  )
  const features: FeatureItem[] = featureItems.map((item) =>
    FeatureItemSchema.parse(item.contentJson),
  )
  const howItWorksMetaItem = (featuresSection?.items || []).find(
    (item) => item.contentType === 'section_meta' || item.itemKey === 'section_meta',
  )
  const howItWorksMeta = howItWorksMetaItem
    ? HowItWorksMetaSchema.parse(howItWorksMetaItem.contentJson)
    : null

  const howItWorks: HowItWorksContent = {
    title:
      howItWorksMeta?.title ??
      featuresSection?.label ??
      FALLBACK_HOW_IT_WORKS_TITLE,
    description:
      howItWorksMeta?.description ?? FALLBACK_HOW_IT_WORKS_DESCRIPTION,
    features,
  }

  return { hero, stats, howItWorks }
}

export const getAboutPageContent = async (): Promise<AboutPageContent> => {
  const page = await prisma.cmsPageContent.findUnique({
    where: { pageKey: 'about', isActive: true },
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
    throw new Error('About page content not found')
  }

  const heroSection = page.sections.find((s) => s.sectionKey === 'hero')
  const valuesSection = page.sections.find((s) => s.sectionKey === 'values')
  const storySection = page.sections.find((s) => s.sectionKey === 'story')

  const heroItem = heroSection?.items[0]
  if (!heroItem) {
    throw new Error('Hero content not found')
  }
  const hero = AboutHeroContentSchema.parse(heroItem.contentJson)

  const values: ValueItem[] = (valuesSection?.items || []).map((item) =>
    ValueItemSchema.parse(item.contentJson),
  )

  const storySections: string[] = (storySection?.items || []).map((item) => {
    const storyData = StoryParagraphSchema.parse(item.contentJson)
    return storyData.text
  })

  return { hero, values, story: { sections: storySections } }
}

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
    }
  })

  await Promise.all(updatePromises)
}
