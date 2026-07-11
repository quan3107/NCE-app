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
  stats: [
    { itemKey: 'stat_students' as const, value: 1_000, label: 'Active students', format: 'number' as const },
    { itemKey: 'stat_band_score' as const, value: 7.5, label: 'Band score', format: 'decimal' as const },
    { itemKey: 'stat_success_rate' as const, value: 0.8, label: 'Success rate', format: 'percentage' as const },
  ],
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

  it.each([
    {
      pageKey: 'homepage' as const,
      sectionKey: 'features',
      itemKey: 'feature_practice',
      content: {
        ...homepageContent,
        howItWorks: {
          ...homepageContent.howItWorks,
          features: [
            {
              icon: 'book-open',
              title: 'Practice',
              description: 'Use authentic tasks.',
            },
          ],
        },
      },
    },
    {
      pageKey: 'about' as const,
      sectionKey: 'values',
      itemKey: 'value_mission',
      content: {
        hero: { title: 'About us', description: 'Learn about our school.' },
        values: [
          {
            icon: 'target',
            title: 'Our Mission',
            description: 'Help every learner succeed.',
          },
        ],
        story: { sections: ['We started with a clear teaching mission.'] },
      },
    },
  ])(
    'preserves the $pageKey bootstrap key during reconciliation',
    async ({ pageKey, sectionKey, itemKey, content }) => {
      const tx = {
        cmsSection: {
          upsert: vi.fn(async ({ create }) => ({ id: `section-${create.sectionKey}` })),
        },
        cmsContentItem: {
          findMany: vi.fn(async ({ where }) =>
            where.sectionId === `section-${sectionKey}`
              ? [{ id: 'bootstrap-item', itemKey, sortOrder: 0, isActive: true }]
              : [],
          ),
          update: vi.fn(async () => ({ id: 'bootstrap-item' })),
          create: vi.fn(async () => ({ id: 'created-item' })),
          deleteMany: vi.fn(async () => ({ count: 0 })),
        },
      }

      await replacePublishedSections(tx as never, 'page-1', pageKey, content)

      expect(tx.cmsContentItem.update).toHaveBeenCalledWith({
        where: { id: 'bootstrap-item' },
        data: expect.objectContaining({ itemKey }),
      })
      expect(tx.cmsContentItem.deleteMany).not.toHaveBeenCalledWith({
        where: { id: { in: ['bootstrap-item'] } },
      })
    },
  )
})
