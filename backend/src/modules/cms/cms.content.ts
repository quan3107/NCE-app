/**
 * Location: backend/src/modules/cms/cms.content.ts
 * Purpose: Convert CMS page payloads between API snapshots and normalized database sections.
 * Why: Publish and rollback must share one deterministic content mapping with public reads.
 */
import { ZodError } from 'zod'

import {
  AboutPageContentSchema,
  ContactPageContentSchema,
  HomepageContentSchema,
  RealtimeStatKeySchema,
  type CmsPageContent,
  type CmsPageKey,
} from './cms.schema.js'
import { StoredCmsContentError } from './cms.errors.js'
import { isManagedCmsItemKey } from './cms.managed.js'

type CmsItemRow = {
  itemKey?: string | null
  sortOrder: number
  contentType: string
  contentJson: unknown
  isActive?: boolean
}

type CmsSectionRow = {
  sectionKey: string
  label: string
  sortOrder: number
  isActive?: boolean
  items: CmsItemRow[]
}

type CmsPageRow = {
  sections: CmsSectionRow[]
}

type SectionCreateInput = Omit<CmsSectionRow, 'items'> & {
  isActive: boolean
  items: { create: Array<CmsItemRow & { isActive: boolean }> }
}

const HOMEPAGE_FEATURE_KEYS = [
  'feature_practice',
  'feature_feedback',
  'feature_progress',
] as const
const ABOUT_VALUE_KEYS = [
  'value_mission',
  'value_success',
  'value_instructors',
  'value_results',
] as const
export const REALTIME_STAT_KEYS = RealtimeStatKeySchema.options

const FALLBACK_HOW_IT_WORKS_TITLE = 'How It Works'
const FALLBACK_HOW_IT_WORKS_DESCRIPTION =
  'Our structured approach helps you improve systematically across all IELTS test components with expert guidance every step of the way.'

function parseStoredContent<T>(pageKey: CmsPageKey, parse: () => T): T {
  try {
    return parse()
  } catch (error) {
    if (error instanceof ZodError) {
      throw new StoredCmsContentError(pageKey, error)
    }
    throw error
  }
}

const item = (
  itemKey: string,
  sortOrder: number,
  contentType: string,
  contentJson: unknown,
) => ({ itemKey, sortOrder, contentType, contentJson, isActive: true })

const section = (
  sectionKey: string,
  label: string,
  sortOrder: number,
  items: ReturnType<typeof item>[],
): SectionCreateInput => ({
  sectionKey,
  label,
  sortOrder,
  isActive: true,
  items: { create: items },
})

function activeSection(page: CmsPageRow, key: string) {
  return page.sections.find(
    (candidate) => candidate.sectionKey === key && candidate.isActive !== false,
  )
}

function activeItems(page: CmsPageRow, key: string) {
  return (activeSection(page, key)?.items ?? [])
    .filter((candidate) => candidate.isActive !== false)
    .sort((left, right) => left.sortOrder - right.sortOrder)
}

function modeledItems(pageKey: CmsPageKey, page: CmsPageRow, key: string) {
  return activeItems(page, key).filter(
    (candidate) =>
      candidate.itemKey == null || isManagedCmsItemKey(pageKey, key, candidate.itemKey),
  )
}

function parseHomepage(page: CmsPageRow) {
  const hero = modeledItems('homepage', page, 'hero')[0]?.contentJson
  const featuresSection = activeSection(page, 'features')
  const featureItems = modeledItems('homepage', page, 'features')
  const meta = featureItems.find(
    (candidate) =>
      candidate.contentType === 'section_meta' || candidate.itemKey === 'section_meta',
  )
  const metaContent = meta?.contentJson as
    | { title?: unknown; description?: unknown }
    | undefined

  return HomepageContentSchema.parse({
    hero,
    stats: activeItems(page, 'stats')
      .filter((candidate) =>
        candidate.itemKey == null || REALTIME_STAT_KEYS.includes(
          candidate.itemKey as (typeof REALTIME_STAT_KEYS)[number],
        ),
      )
      .map((candidate, index) => ({
        ...(candidate.contentJson as object),
        itemKey: candidate.itemKey ?? REALTIME_STAT_KEYS[index],
      })),
    howItWorks: {
      title: metaContent?.title ?? featuresSection?.label ?? FALLBACK_HOW_IT_WORKS_TITLE,
      description: metaContent?.description ?? FALLBACK_HOW_IT_WORKS_DESCRIPTION,
      features: featureItems
        .filter((candidate) => candidate !== meta && candidate.contentType === 'feature')
        .map((candidate) => candidate.contentJson),
    },
  })
}

function parseAbout(page: CmsPageRow) {
  return AboutPageContentSchema.parse({
    hero: modeledItems('about', page, 'hero')[0]?.contentJson,
    values: modeledItems('about', page, 'values').map(
      (candidate) => candidate.contentJson,
    ),
    story: {
      sections: modeledItems('about', page, 'story').map(
        (candidate) => (candidate.contentJson as { text: string }).text,
      ),
    },
  })
}

function parseContact(page: CmsPageRow) {
  return ContactPageContentSchema.parse({
    header: modeledItems('contact', page, 'header')[0]?.contentJson,
    form: modeledItems('contact', page, 'form')[0]?.contentJson,
    details: modeledItems('contact', page, 'details')[0]?.contentJson,
    hours: modeledItems('contact', page, 'hours').map(
      (candidate) => candidate.contentJson,
    ),
  })
}

export function parseCmsPageContent(
  pageKey: CmsPageKey,
  page: CmsPageRow,
): CmsPageContent {
  return parseStoredContent(pageKey, () => {
    if (pageKey === 'homepage') return parseHomepage(page)
    if (pageKey === 'about') return parseAbout(page)
    return parseContact(page)
  })
}

export function validateCmsPageContent(
  pageKey: CmsPageKey,
  content: unknown,
): CmsPageContent {
  if (pageKey === 'homepage') return HomepageContentSchema.parse(content)
  if (pageKey === 'about') return AboutPageContentSchema.parse(content)
  return ContactPageContentSchema.parse(content)
}

export function validateStoredCmsPageContent(
  pageKey: CmsPageKey,
  content: unknown,
): CmsPageContent {
  return parseStoredContent(pageKey, () => {
    if (pageKey !== 'homepage') return validateCmsPageContent(pageKey, content)
    if (!content || typeof content !== 'object') {
      return validateCmsPageContent(pageKey, content)
    }
    const candidate = content as { stats?: unknown }
    if (!Array.isArray(candidate.stats)) {
      return validateCmsPageContent(pageKey, content)
    }
    return validateCmsPageContent(pageKey, {
      ...candidate,
      stats: candidate.stats.map((stat, index) =>
        stat && typeof stat === 'object' && !('itemKey' in stat)
          ? { ...stat, itemKey: REALTIME_STAT_KEYS[index] }
          : stat,
      ),
    })
  })
}

function homepageSections(content: ReturnType<typeof HomepageContentSchema.parse>) {
  return [
    section('hero', 'Hero Section', 0, [item('hero_main', 0, 'hero', content.hero)]),
    section(
      'stats',
      'Statistics',
      1,
      content.stats.map(({ itemKey, ...value }, index) =>
        item(itemKey, index, 'stat', value),
      ),
    ),
    section('features', 'How It Works', 2, [
      item('section_meta', 0, 'section_meta', {
        title: content.howItWorks.title,
        description: content.howItWorks.description,
      }),
      ...content.howItWorks.features.map((value, index) =>
        item(
          HOMEPAGE_FEATURE_KEYS[index] ?? `feature_${index + 1}`,
          index + 1,
          'feature',
          value,
        ),
      ),
    ]),
  ]
}

function aboutSections(content: ReturnType<typeof AboutPageContentSchema.parse>) {
  return [
    section('hero', 'Hero Section', 0, [item('hero_main', 0, 'hero', content.hero)]),
    section(
      'values',
      'Our Values',
      1,
      content.values.map((value, index) =>
        item(ABOUT_VALUE_KEYS[index] ?? `value_${index + 1}`, index, 'value', value),
      ),
    ),
    section(
      'story',
      'Our Story',
      2,
      content.story.sections.map((text, index) =>
        item(`story_p${index + 1}`, index, 'story_paragraph', { text }),
      ),
    ),
  ]
}

function contactSections(content: ReturnType<typeof ContactPageContentSchema.parse>) {
  return [
    section('header', 'Page Header', 0, [
      item('header_main', 0, 'header', content.header),
    ]),
    section('form', 'Contact Form', 1, [item('form_main', 0, 'form', content.form)]),
    section('details', 'Contact Information', 2, [
      item('details_main', 0, 'contact_details', content.details),
    ]),
    section(
      'hours',
      'Office Hours',
      3,
      content.hours.map((value, index) =>
        item(`hours_${index + 1}`, index, 'office_hours', value),
      ),
    ),
  ]
}

export function toCmsSectionsCreateInput(
  pageKey: CmsPageKey,
  content: unknown,
): SectionCreateInput[] {
  const validated = validateCmsPageContent(pageKey, content)
  if (pageKey === 'homepage') {
    return homepageSections(validated as ReturnType<typeof HomepageContentSchema.parse>)
  }
  if (pageKey === 'about') {
    return aboutSections(validated as ReturnType<typeof AboutPageContentSchema.parse>)
  }
  return contactSections(validated as ReturnType<typeof ContactPageContentSchema.parse>)
}
