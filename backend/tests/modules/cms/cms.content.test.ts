/**
 * File: tests/modules/cms/cms.content.test.ts
 * Purpose: Verify CMS page snapshots convert to and from normalized section rows.
 * Why: Draft publishing and rollback must preserve the public content contract exactly.
 */
import { describe, expect, it } from 'vitest'

import {
  parseCmsPageContent,
  toCmsSectionsCreateInput,
  validateCmsPageContent,
} from '../../../src/modules/cms/cms.content.js'

const homepage = {
  hero: {
    badge: 'Focused preparation',
    title: 'Reach your target score',
    description: 'Practice with expert support.',
    cta_primary: 'Browse courses',
    cta_secondary: 'Teacher login',
  },
  stats: [{ label: 'Learners', value: 42, format: 'number' as const, suffix: '+' }],
  howItWorks: {
    title: 'How it works',
    description: 'Three focused steps.',
    features: [{ icon: 'book-open', title: 'Practice', description: 'Use real tasks.' }],
  },
}

describe('cms content conversion', () => {
  it('rejects empty or whitespace-only required public text', () => {
    expect(() =>
      validateCmsPageContent('homepage', {
        ...homepage,
        hero: { ...homepage.hero, title: '' },
      }),
    ).toThrow()
    expect(() =>
      validateCmsPageContent('about', {
        hero: { title: 'About us', description: '' },
        values: [],
        story: { sections: ['Our story'] },
      }),
    ).toThrow()
    expect(() =>
      validateCmsPageContent('contact', {
        header: { title: '   ', description: 'Get in touch.' },
        form: { title: 'Message us', description: 'We can help.', submitLabel: 'Send' },
        details: { email: 'support@example.com', phone: '123', address: 'Office' },
        hours: [],
      }),
    ).toThrow()
  })

  it('round-trips homepage snapshots through normalized sections', () => {
    const sections = toCmsSectionsCreateInput('homepage', homepage)
    const normalizedPage = {
      sections: sections.map((section) => ({
        ...section,
        items: section.items.create,
      })),
    }

    expect(parseCmsPageContent('homepage', normalizedPage)).toEqual(homepage)
  })

  it('does not duplicate an active custom array item on publish round-trip', () => {
    const sections = toCmsSectionsCreateInput('homepage', homepage)
    const normalizedPage = {
      sections: sections.map((section) => ({
        ...section,
        items: section.items.create,
      })),
    }
    const stats = normalizedPage.sections.find(
      (section) => section.sectionKey === 'stats',
    )
    stats?.items.push({
      itemKey: 'custom_stat',
      sortOrder: 1,
      contentType: 'stat',
      contentJson: homepage.stats[0],
      isActive: true,
    })

    const parsed = parseCmsPageContent('homepage', normalizedPage)
    const republished = toCmsSectionsCreateInput('homepage', parsed)
    const republishedStats = republished.find(
      (section) => section.sectionKey === 'stats',
    )

    expect(parsed.stats).toEqual(homepage.stats)
    expect(republishedStats?.items.create).toHaveLength(1)
  })

  it('preserves legacy homepage metadata when section_meta is missing', () => {
    const legacyPage = {
      sections: [
        { sectionKey: 'hero', label: 'Hero', sortOrder: 0, items: [
          { sortOrder: 0, contentType: 'hero', contentJson: homepage.hero },
        ] },
        { sectionKey: 'stats', label: 'Statistics', sortOrder: 1, items: [] },
        { sectionKey: 'features', label: 'Legacy How It Works', sortOrder: 2, items: [
          { sortOrder: 0, contentType: 'feature', contentJson: homepage.howItWorks.features[0] },
        ] },
      ],
    }

    expect(parseCmsPageContent('homepage', legacyPage).howItWorks).toEqual({
      title: 'Legacy How It Works',
      description:
        'Our structured approach helps you improve systematically across all IELTS test components with expert guidance every step of the way.',
      features: homepage.howItWorks.features,
    })
  })

  it('reads legacy homepage metadata identified only by itemKey', () => {
    const legacyPage = {
      sections: [
        { sectionKey: 'hero', label: 'Hero', sortOrder: 0, items: [
          { sortOrder: 0, contentType: 'hero', contentJson: homepage.hero },
        ] },
        { sectionKey: 'stats', label: 'Statistics', sortOrder: 1, items: [] },
        { sectionKey: 'features', label: 'Fallback label', sortOrder: 2, items: [
          {
            itemKey: 'section_meta',
            sortOrder: 0,
            contentType: 'feature',
            contentJson: { title: 'Saved legacy title', description: 'Saved legacy description' },
          },
          { sortOrder: 1, contentType: 'feature', contentJson: homepage.howItWorks.features[0] },
        ] },
      ],
    }

    expect(parseCmsPageContent('homepage', legacyPage).howItWorks).toEqual({
      title: 'Saved legacy title',
      description: 'Saved legacy description',
      features: homepage.howItWorks.features,
    })
  })

  it('round-trips contact content needed by the public contact route', () => {
    const contact = {
      header: {
        title: 'Contact us',
        description: 'We reply within one business day.',
      },
      form: {
        title: 'Send us a message',
        description: 'Tell us how we can help.',
        submitLabel: 'Send message',
      },
      details: {
        email: 'support@example.com',
        phone: '+1 555 0100',
        address: '123 Education Street',
      },
      hours: [{ label: 'Monday - Friday', value: '9:00 AM - 6:00 PM' }],
    }

    const sections = toCmsSectionsCreateInput('contact', contact)
    const normalizedPage = {
      sections: sections.map((section) => ({
        ...section,
        items: section.items.create,
      })),
    }

    expect(parseCmsPageContent('contact', normalizedPage)).toEqual(contact)
  })
})
