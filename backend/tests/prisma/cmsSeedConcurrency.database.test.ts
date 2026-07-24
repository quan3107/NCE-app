/**
 * File: tests/prisma/cmsSeedConcurrency.database.test.ts
 * Purpose: Reproduce overlapping standalone CMS seed entrypoints on PostgreSQL.
 * Why: Separate seed processes must converge when the same managed page is missing.
 */
import { PrismaPg } from '@prisma/adapter-pg'
import type { PoolClient } from 'pg'
import { describe, expect, it } from 'vitest'

import { PrismaClient } from '../../src/prisma/generated.js'
import { REFERENCE_BOOTSTRAP_LOCK_ID } from '../../src/prisma/referenceBootstrapLock.js'
import { seedCmsContent } from '../../src/prisma/seeds/cmsContent.seed.js'
import { createDatabaseTestOwnerPool } from './databaseTestClient.js'

const CMS_SEED_TEST_LOCK_ID = 2_026_072_402
const TRIGGER_NAME = 'nce_test_wait_for_cms_seed'
const FUNCTION_NAME = 'nce_test_wait_for_cms_seed'
const databaseDescribe =
  process.env.CI === 'true' || process.env.RUN_DATABASE_TESTS === 'true'
    ? describe.sequential
    : describe.skip

async function waitForBlockedCmsSeeds(
  observer: PoolClient,
  expectedCount: number,
): Promise<void> {
  const deadline = Date.now() + 5_000
  while (Date.now() < deadline) {
    const result = await observer.query<{ waiting: number }>(
      `SELECT count(*)::int AS waiting
       FROM pg_locks
       WHERE locktype = 'advisory'
         AND objid = $1::oid
         AND NOT granted`,
      [CMS_SEED_TEST_LOCK_ID],
    )
    if (result.rows[0]?.waiting === expectedCount) return
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
  throw new Error('CMS seed entrypoints did not overlap at the insert barrier.')
}

databaseDescribe('CMS seed entrypoint concurrency', () => {
  it('converges two independent entrypoints on one missing page', async () => {
    const observerPool = createDatabaseTestOwnerPool()
    const observer = await observerPool.connect()
    const seedPools = [createDatabaseTestOwnerPool(), createDatabaseTestOwnerPool()]
    const seedClients = seedPools.map(
      (pool) => new PrismaClient({ adapter: new PrismaPg(pool) }),
    )
    let lockHeld = false
    let runners: Promise<void>[] = []

    try {
      await observer.query(
        'SELECT pg_advisory_lock($1::bigint), pg_advisory_lock($2::bigint)',
        [CMS_SEED_TEST_LOCK_ID, REFERENCE_BOOTSTRAP_LOCK_ID],
      )
      lockHeld = true
      await observer.query(
        `DROP TRIGGER IF EXISTS ${TRIGGER_NAME} ON public.cms_page_contents`,
      )
      await observer.query(`
        CREATE OR REPLACE FUNCTION public.${FUNCTION_NAME}()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $$
        BEGIN
          PERFORM pg_advisory_xact_lock(${CMS_SEED_TEST_LOCK_ID}::bigint);
          RETURN NEW;
        END;
        $$
      `)
      await observer.query(`
        CREATE TRIGGER ${TRIGGER_NAME}
        BEFORE INSERT ON public.cms_page_contents
        FOR EACH ROW
        WHEN (NEW.page_key = 'contact')
        EXECUTE FUNCTION public.${FUNCTION_NAME}()
      `)
      await seedClients[0].cmsPageContent.deleteMany({
        where: { pageKey: 'contact' },
      })

      runners = seedClients.map((client) => seedCmsContent(client))
      await waitForBlockedCmsSeeds(observer, runners.length)
      await observer.query(
        'SELECT pg_advisory_unlock($1::bigint), pg_advisory_unlock($2::bigint)',
        [CMS_SEED_TEST_LOCK_ID, REFERENCE_BOOTSTRAP_LOCK_ID],
      )
      lockHeld = false
      await Promise.all(runners)

      const contactPage = await seedClients[0].cmsPageContent.findUniqueOrThrow({
        where: { pageKey: 'contact' },
        include: { revisions: true, sections: true },
      })
      expect(contactPage.revisions).toHaveLength(1)
      expect(contactPage.sections.length).toBeGreaterThan(0)
    } finally {
      try {
        if (lockHeld) {
          await observer.query(
            'SELECT pg_advisory_unlock($1::bigint), pg_advisory_unlock($2::bigint)',
            [CMS_SEED_TEST_LOCK_ID, REFERENCE_BOOTSTRAP_LOCK_ID],
          )
        }
        await Promise.allSettled(runners)
        await observer.query(
          `DROP TRIGGER IF EXISTS ${TRIGGER_NAME} ON public.cms_page_contents`,
        )
        await observer.query(`DROP FUNCTION IF EXISTS public.${FUNCTION_NAME}()`)
        await seedCmsContent(seedClients[0])
      } finally {
        await Promise.allSettled(seedClients.map((client) => client.$disconnect()))
        await Promise.all(seedPools.map((pool) => pool.end()))
        observer.release()
        await observerPool.end()
      }
    }
  }, 20_000)
})
