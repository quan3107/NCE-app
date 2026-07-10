/**
 * File: tests/modules/cms/cms.content.test.ts
 * Purpose: Verify CMS page snapshots convert to and from normalized section rows.
 * Why: Draft publishing and rollback must preserve the public content contract exactly.
 */
import { describe, expect, it } from 'vitest'

import {
  parseCmsPageContent,
  toCmsSectionsCreateInput,
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
