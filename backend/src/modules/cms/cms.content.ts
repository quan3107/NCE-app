/**
 * Location: backend/src/modules/cms/cms.content.ts
 * Purpose: Convert CMS page payloads between API snapshots and normalized database sections.
 * Why: Publish and rollback must share one deterministic content mapping with public reads.
 */
import {
  AboutPageContentSchema,
  ContactPageContentSchema,
  HomepageContentSchema,
  type CmsPageContent,
  type CmsPageKey,
} from './cms.schema.js'

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

function parseHomepage(page: CmsPageRow) {
  const hero = activeItems(page, 'hero')[0]?.contentJson
  const featureItems = activeItems(page, 'features')
  const meta = featureItems.find((candidate) => candidate.contentType === 'section_meta')

  return HomepageContentSchema.parse({
    hero,
    stats: activeItems(page, 'stats').map((candidate) => candidate.contentJson),
    howItWorks: {
      title: (meta?.contentJson as { title?: unknown } | undefined)?.title,
      description: (meta?.contentJson as { description?: unknown } | undefined)
        ?.description,
      features: featureItems
        .filter((candidate) => candidate.contentType === 'feature')
        .map((candidate) => candidate.contentJson),
    },
  })
}

function parseAbout(page: CmsPageRow) {
  return AboutPageContentSchema.parse({
    hero: activeItems(page, 'hero')[0]?.contentJson,
    values: activeItems(page, 'values').map((candidate) => candidate.contentJson),
    story: {
      sections: activeItems(page, 'story').map(
        (candidate) => (candidate.contentJson as { text: string }).text,
      ),
    },
  })
}

function parseContact(page: CmsPageRow) {
  return ContactPageContentSchema.parse({
    header: activeItems(page, 'header')[0]?.contentJson,
    form: activeItems(page, 'form')[0]?.contentJson,
    details: activeItems(page, 'details')[0]?.contentJson,
    hours: activeItems(page, 'hours').map((candidate) => candidate.contentJson),
  })
}

export function parseCmsPageContent(
  pageKey: CmsPageKey,
  page: CmsPageRow,
): CmsPageContent {
  if (pageKey === 'homepage') return parseHomepage(page)
  if (pageKey === 'about') return parseAbout(page)
  return parseContact(page)
}

export function validateCmsPageContent(
  pageKey: CmsPageKey,
  content: unknown,
): CmsPageContent {
  if (pageKey === 'homepage') return HomepageContentSchema.parse(content)
  if (pageKey === 'about') return AboutPageContentSchema.parse(content)
  return ContactPageContentSchema.parse(content)
}

function homepageSections(content: ReturnType<typeof HomepageContentSchema.parse>) {
  return [
    section('hero', 'Hero Section', 0, [item('hero_main', 0, 'hero', content.hero)]),
    section(
      'stats',
      'Statistics',
      1,
      content.stats.map((value, index) =>
        item(
          ['stat_students', 'stat_band_score', 'stat_success_rate'][index] ??
            `stat_${index + 1}`,
          index,
          'stat',
          value,
        ),
      ),
    ),
    section('features', 'How It Works', 2, [
      item('section_meta', 0, 'section_meta', {
        title: content.howItWorks.title,
        description: content.howItWorks.description,
      }),
      ...content.howItWorks.features.map((value, index) =>
        item(`feature_${index + 1}`, index + 1, 'feature', value),
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
        item(`value_${index + 1}`, index, 'value', value),
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
