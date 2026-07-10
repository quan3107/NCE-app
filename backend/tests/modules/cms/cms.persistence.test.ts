/**
 * Location: tests/modules/cms/cms.persistence.test.ts
 * Purpose: Verify normalized CMS row reconciliation behavior.
 * Why: Publishing must migrate legacy modeled rows without duplicating content.
 */
import { describe, expect, it, vi } from 'vitest'

import { replacePublishedSections } from '../../../src/modules/cms/cms.persistence.js'

const homepageContent = {
  hero: {
    badge: 'Learn English',
    title: 'Build confidence',
    description: 'Study with experienced teachers.',
    cta_primary: 'Browse courses',
    cta_secondary: 'Sign in',
  },
  stats: [{ value: 1_000, label: 'Active students', format: 'number' as const }],
  howItWorks: {
    title: 'How it works',
    description: 'A clear learning path.',
    features: [],
  },
}

describe('CMS persistence', () => {
  it('updates an active keyless modeled item with its canonical key', async () => {
    const tx = {
      cmsSection: {
        upsert: vi.fn(async ({ create }) => ({ id: `section-${create.sectionKey}` })),
      },
      cmsContentItem: {
        findMany: vi.fn(async ({ where }) =>
          where.sectionId === 'section-stats'
            ? [{ id: 'legacy-stat', itemKey: null, sortOrder: 7, isActive: true }]
            : [],
        ),
        update: vi.fn(async () => ({ id: 'legacy-stat' })),
        create: vi.fn(async () => ({ id: 'created-item' })),
        deleteMany: vi.fn(async () => ({ count: 0 })),
      },
    }

    await replacePublishedSections(tx as never, 'page-1', 'homepage', homepageContent)

    expect(tx.cmsContentItem.update).toHaveBeenCalledWith({
      where: { id: 'legacy-stat' },
      data: expect.objectContaining({ itemKey: 'stat_students', sortOrder: 0 }),
    })
    expect(tx.cmsContentItem.create).not.toHaveBeenCalledWith({
      data: expect.objectContaining({
        sectionId: 'section-stats',
        itemKey: 'stat_students',
      }),
    })
  })
})
