/**
 * Location: tests/prisma/cmsKeylessStatsRevisionRepair.database.test.ts
 * Purpose: Exercise forward repairs for legacy keyless homepage baseline revisions.
 * Why: Revision 1 must remain rollback-safe across custom rows and intervening publishes.
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { validateStoredCmsPageContent } from '../../src/modules/cms/cms.content.js'
import { replacePublishedSections } from '../../src/modules/cms/cms.persistence.js'
import { HomepageContentSchema } from '../../src/modules/cms/cms.schema.js'
import { basePrisma } from '../../src/prisma/client.js'
import type { Prisma } from '../../src/prisma/generated.js'

const repairPath = resolve(
  import.meta.dirname,
  '../../src/prisma/migrations/20260712140000_repair_malformed_homepage_baseline/migration.sql',
)
const repairMigration = existsSync(repairPath) ? readFileSync(repairPath, 'utf8') : ''
const repairStart = repairMigration.indexOf('WITH invalid_baselines AS')
const repairEnd = repairMigration.indexOf('\n\nCOMMIT;', repairStart)
const repairSql = repairMigration.slice(repairStart, repairEnd)
const rollbackSignal = new Error('ROLLBACK_DATABASE_TEST')

const publishedContent = HomepageContentSchema.parse({
  hero: {
    badge: 'Badge',
    title: 'Homepage',
    description: 'Homepage description',
    cta_primary: 'Browse',
    cta_secondary: 'Sign in',
  },
  stats: [
    { itemKey: 'stat_students', label: 'Students', value: 10, format: 'number' },
    {
      itemKey: 'stat_band_score',
      label: 'Band score',
      value: 7.5,
      format: 'decimal',
    },
    {
      itemKey: 'stat_success_rate',
      label: 'Success rate',
      value: 0.8,
      format: 'percentage',
    },
  ],
  howItWorks: {
    title: 'How It Works',
    description: 'How it works description',
    features: [],
  },
})

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

async function createBrokenHomepage(tx: Prisma.TransactionClient) {
  await tx.cmsPageContent.deleteMany({ where: { pageKey: 'homepage' } })
  return tx.cmsPageContent.create({
    data: {
      pageKey: 'homepage',
      label: 'Homepage',
      isActive: true,
      publishedRevision: 1,
      publishedAt: new Date(),
      sections: {
        create: {
          sectionKey: 'stats',
          label: 'Statistics',
          sortOrder: 1,
          isActive: true,
          items: {
            create: [
              ...publishedContent.stats.map(
                ({ itemKey: _itemKey, ...content }, index) => ({
                  itemKey: null,
                  sortOrder: index,
                  contentType: 'stat',
                  isActive: true,
                  contentJson: content,
                }),
              ),
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
      },
      revisions: {
        create: {
          revisionNumber: 1,
          operation: 'publish',
          contentJson: { ...publishedContent, stats: [] },
        },
      },
    },
  })
}

async function getRevisionOne(tx: Prisma.TransactionClient, pageId: string) {
  return tx.cmsPageRevision.findUniqueOrThrow({
    where: { pageId_revisionNumber: { pageId, revisionNumber: 1 } },
  })
}

async function getStatsSection(tx: Prisma.TransactionClient, pageId: string) {
  return tx.cmsSection.findUniqueOrThrow({
    where: { pageId_sectionKey: { pageId, sectionKey: 'stats' } },
    include: { items: { orderBy: { sortOrder: 'asc' } } },
  })
}

const databaseDescribe =
  process.env.CI === 'true' || process.env.RUN_DATABASE_TESTS === 'true'
    ? describe
    : describe.skip

databaseDescribe('CMS keyless homepage baseline repair', () => {
  it('uses the earliest valid revision after an intervening publish', async () => {
    expect(existsSync(repairPath)).toBe(true)
    if (!existsSync(repairPath)) return

    await withRolledBackDatabase(async (tx) => {
      const page = await createBrokenHomepage(tx)
      await replacePublishedSections(tx, page.id, 'homepage', publishedContent)
      await tx.cmsPageRevision.create({
        data: {
          pageId: page.id,
          revisionNumber: 2,
          operation: 'publish',
          contentJson: publishedContent,
        },
      })
      await tx.cmsPageContent.update({
        where: { id: page.id },
        data: { publishedRevision: 2 },
      })

      const statsBeforeRepair = await getStatsSection(tx, page.id)
      const students = statsBeforeRepair.items.find(
        (item) => item.itemKey === 'stat_students',
      )!
      await tx.cmsContentItem.update({
        where: { id: students.id },
        data: {
          contentJson: { label: 'Current students', value: 999, format: 'number' },
        },
      })

      expect(await tx.$executeRawUnsafe(repairSql)).toBe(1)
      const repaired = validateStoredCmsPageContent(
        'homepage',
        (await getRevisionOne(tx, page.id)).contentJson,
      )
      expect(repaired.stats[0]).toMatchObject({
        itemKey: 'stat_students',
        label: 'Students',
        value: 10,
      })

      await replacePublishedSections(tx, page.id, 'homepage', repaired)
      const statsAfterRollback = await getStatsSection(tx, page.id)
      expect(statsAfterRollback.items.map((item) => item.itemKey)).toEqual([
        'stat_students',
        'stat_band_score',
        'stat_success_rate',
        'custom_stat',
      ])
      expect(await tx.$executeRawUnsafe(repairSql)).toBe(0)
    })
  }, 15_000)

  it('rejects a malformed later revision and uses the canonical fallback', async () => {
    expect(existsSync(repairPath)).toBe(true)
    if (!existsSync(repairPath)) return

    await withRolledBackDatabase(async (tx) => {
      const page = await createBrokenHomepage(tx)
      await replacePublishedSections(tx, page.id, 'homepage', publishedContent)
      const malformedStats = publishedContent.stats.map((stat, index) =>
        index === 0
          ? { itemKey: stat.itemKey, value: stat.value, format: stat.format }
          : stat,
      )
      await tx.cmsPageRevision.update({
        where: { pageId_revisionNumber: { pageId: page.id, revisionNumber: 1 } },
        data: { contentJson: { ...publishedContent, stats: malformedStats } },
      })
      await tx.cmsPageRevision.create({
        data: {
          pageId: page.id,
          revisionNumber: 2,
          operation: 'publish',
          contentJson: { ...publishedContent, stats: malformedStats },
        },
      })

      expect(await tx.$executeRawUnsafe(repairSql)).toBe(1)
      const repaired = validateStoredCmsPageContent(
        'homepage',
        (await getRevisionOne(tx, page.id)).contentJson,
      )
      expect(repaired.stats).toEqual(publishedContent.stats)
      expect((await getStatsSection(tx, page.id)).items.at(-1)?.itemKey).toBe(
        'custom_stat',
      )
    })
  }, 15_000)
})
