/**
 * Location: tests/prisma/cmsBootstrapUpgrade.database.test.ts
 * Purpose: Exercise CMS baseline and seed revisions against a migrated PostgreSQL database.
 * Why: Revision snapshots must exclude custom rows and remain safe inputs for rollback reconciliation.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  parseCmsPageContent,
  validateStoredCmsPageContent,
} from '../../src/modules/cms/cms.content.js'
import { replacePublishedSections } from '../../src/modules/cms/cms.persistence.js'
import { basePrisma } from '../../src/prisma/client.js'
import type { Prisma } from '../../src/prisma/generated.js'
import { CMS_PAGES } from '../../src/prisma/seeds/cmsContent.data.js'
import { createPageIfMissing } from '../../src/prisma/seeds/cmsContent.seed.js'

const migration = readFileSync(
  resolve(
    import.meta.dirname,
    '../../src/prisma/migrations/20260710110000_bootstrap_cms_admin_data/migration.sql',
  ),
  'utf8',
)
const snapshotStart = migration.indexOf('WITH managed_pages AS')
const snapshotEnd = migration.indexOf(
  '\n\nUPDATE public.cms_page_contents page',
  snapshotStart,
)
const snapshotInsertSql = migration.slice(snapshotStart, snapshotEnd)
const rollbackSignal = new Error('ROLLBACK_DATABASE_TEST')

async function withRolledBackDatabase(
  operation: (tx: Prisma.TransactionClient) => Promise<void>,
) {
  await expect(
    basePrisma.$transaction(
      async (tx) => {
        await operation(tx)
        throw rollbackSignal
      },
      { timeout: 15_000 },
    ),
  ).rejects.toBe(rollbackSignal)
}

const databaseDescribe =
  process.env.CI === 'true' || process.env.RUN_DATABASE_TESTS === 'true'
    ? describe
    : describe.skip

databaseDescribe('CMS bootstrap database upgrades', () => {
  it('excludes a custom keyed stat from revision 1 and preserves it once on rollback', async () => {
    await withRolledBackDatabase(async (tx) => {
      await tx.cmsPageContent.deleteMany({ where: { pageKey: 'homepage' } })
      const page = await tx.cmsPageContent.create({
        data: {
          pageKey: 'homepage',
          label: 'Homepage',
          isActive: true,
          publishedAt: new Date(),
          sections: {
            create: [
              {
                sectionKey: 'hero',
                label: 'Hero',
                sortOrder: 0,
                isActive: true,
                items: {
                  create: [
                    {
                      itemKey: 'hero_main',
                      sortOrder: 0,
                      contentType: 'hero',
                      isActive: true,
                      contentJson: {
                        badge: 'Badge',
                        title: 'Homepage',
                        description: 'Homepage description',
                        cta_primary: 'Browse',
                        cta_secondary: 'Sign in',
                      },
                    },
                  ],
                },
              },
              {
                sectionKey: 'stats',
                label: 'Statistics',
                sortOrder: 1,
                isActive: true,
                items: {
                  create: [
                    {
                      itemKey: 'stat_students',
                      sortOrder: 0,
                      contentType: 'stat',
                      isActive: true,
                      contentJson: { label: 'Students', value: 10, format: 'number' },
                    },
                    {
                      itemKey: 'stat_band_score',
                      sortOrder: 1,
                      contentType: 'stat',
                      isActive: true,
                      contentJson: { label: 'Band score', value: 7.5, format: 'decimal' },
                    },
                    {
                      itemKey: 'stat_success_rate',
                      sortOrder: 2,
                      contentType: 'stat',
                      isActive: true,
                      contentJson: { label: 'Success rate', value: 0.8, format: 'percentage' },
                    },
                    {
                      itemKey: 'custom_stat',
                      sortOrder: 3,
                      contentType: 'stat',
                      isActive: true,
                      contentJson: { label: 'Custom', value: 99, format: 'number' },
                    },
                  ],
                },
              },
              {
                sectionKey: 'features',
                label: 'How It Works',
                sortOrder: 2,
                isActive: true,
                items: { create: [] },
              },
            ],
          },
        },
      })

      await tx.$executeRawUnsafe(snapshotInsertSql)
      const revision = await tx.cmsPageRevision.findUniqueOrThrow({
        where: { pageId_revisionNumber: { pageId: page.id, revisionNumber: 1 } },
      })
      const content = validateStoredCmsPageContent('homepage', revision.contentJson)
      expect(content.stats.map((stat) => stat.itemKey)).toEqual([
        'stat_students',
        'stat_band_score',
        'stat_success_rate',
      ])

      await replacePublishedSections(tx, page.id, 'homepage', content)
      const statsSection = await tx.cmsSection.findUniqueOrThrow({
        where: { pageId_sectionKey: { pageId: page.id, sectionKey: 'stats' } },
        include: { items: { orderBy: { sortOrder: 'asc' } } },
      })
      expect(statsSection.items.map((item) => item.itemKey)).toEqual([
        'stat_students',
        'stat_band_score',
        'stat_success_rate',
        'custom_stat',
      ])
      expect(
        statsSection.items.filter((item) => item.itemKey === 'custom_stat'),
      ).toHaveLength(1)
    })
  })

  it('creates a rollback-capable revision 1 when the seed restores a missing page', async () => {
    await withRolledBackDatabase(async (tx) => {
      const aboutSeed = CMS_PAGES.find((page) => page.pageKey === 'about')!
      await tx.cmsPageContent.deleteMany({ where: { pageKey: 'about' } })
      const pageId = await createPageIfMissing(tx, aboutSeed)
      const page = await tx.cmsPageContent.findUniqueOrThrow({
        where: { id: pageId },
        include: {
          revisions: true,
          sections: {
            orderBy: { sortOrder: 'asc' },
            include: { items: { orderBy: { sortOrder: 'asc' } } },
          },
        },
      })

      expect(page.publishedRevision).toBe(1)
      expect(page.revisions).toHaveLength(1)
      expect(page.revisions[0]).toMatchObject({ revisionNumber: 1, operation: 'publish' })
      const revisionContent = validateStoredCmsPageContent(
        'about',
        page.revisions[0]!.contentJson,
      )

      await replacePublishedSections(tx, page.id, 'about', revisionContent)
      const reloaded = await tx.cmsPageContent.findUniqueOrThrow({
        where: { id: page.id },
        include: {
          sections: {
            orderBy: { sortOrder: 'asc' },
            include: { items: { orderBy: { sortOrder: 'asc' } } },
          },
        },
      })
      expect(parseCmsPageContent('about', reloaded)).toEqual(revisionContent)
    })
  })
})
