/**
 * Location: tests/prisma/cmsKeylessStatsRevisionRepair.database.test.ts
 * Purpose: Exercise the forward repair for legacy keyless homepage baseline revisions.
 * Why: Revision 1 must remain valid rollback content when runtime-supported stat keys are null.
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { validateStoredCmsPageContent } from '../../src/modules/cms/cms.content.js'
import { basePrisma } from '../../src/prisma/client.js'
import type { Prisma } from '../../src/prisma/generated.js'

const repairPath = resolve(
  import.meta.dirname,
  '../../src/prisma/migrations/20260712110000_repair_keyless_homepage_baseline/migration.sql',
)
const repairMigration = existsSync(repairPath) ? readFileSync(repairPath, 'utf8') : ''
const repairStart = repairMigration.indexOf('WITH active_stats AS')
const repairEnd = repairMigration.indexOf('\n\nCOMMIT;', repairStart)
const repairSql = repairMigration.slice(repairStart, repairEnd)
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

databaseDescribe('CMS keyless homepage baseline repair', () => {
  it('repairs an empty revision 1 snapshot from three ordered keyless stats', async () => {
    expect(existsSync(repairPath)).toBe(true)
    if (!existsSync(repairPath)) return

    await withRolledBackDatabase(async (tx) => {
      await tx.cmsPageContent.deleteMany({ where: { pageKey: 'homepage' } })
      const page = await tx.cmsPageContent.create({
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
                  {
                    itemKey: null,
                    sortOrder: 0,
                    contentType: 'stat',
                    isActive: true,
                    contentJson: { label: 'Students', value: 10, format: 'number' },
                  },
                  {
                    itemKey: null,
                    sortOrder: 1,
                    contentType: 'stat',
                    isActive: true,
                    contentJson: {
                      label: 'Band score',
                      value: 7.5,
                      format: 'decimal',
                    },
                  },
                  {
                    itemKey: null,
                    sortOrder: 2,
                    contentType: 'stat',
                    isActive: true,
                    contentJson: {
                      label: 'Success rate',
                      value: 0.8,
                      format: 'percentage',
                    },
                  },
                ],
              },
            },
          },
          revisions: {
            create: {
              revisionNumber: 1,
              operation: 'publish',
              contentJson: {
                hero: {
                  badge: 'Badge',
                  title: 'Homepage',
                  description: 'Homepage description',
                  cta_primary: 'Browse',
                  cta_secondary: 'Sign in',
                },
                stats: [],
                howItWorks: {
                  title: 'How It Works',
                  description: 'How it works description',
                  features: [],
                },
              },
            },
          },
        },
      })

      expect(await tx.$executeRawUnsafe(repairSql)).toBe(1)
      const revision = await tx.cmsPageRevision.findUniqueOrThrow({
        where: { pageId_revisionNumber: { pageId: page.id, revisionNumber: 1 } },
      })
      const content = validateStoredCmsPageContent('homepage', revision.contentJson)

      expect(content.stats.map(({ itemKey, value }) => ({ itemKey, value }))).toEqual([
        { itemKey: 'stat_students', value: 10 },
        { itemKey: 'stat_band_score', value: 7.5 },
        { itemKey: 'stat_success_rate', value: 0.8 },
      ])
      expect(await tx.$executeRawUnsafe(repairSql)).toBe(0)
    })
  })
})
