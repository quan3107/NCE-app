/**
 * File: tests/prisma/cmsSeedConcurrency.database.test.ts
 * Purpose: Reproduce overlapping reference and standalone CMS seeds on PostgreSQL.
 * Why: Production seed entrypoints must converge when the same managed page is missing.
 */
import { PrismaPg } from '@prisma/adapter-pg'
import type { Pool, PoolClient } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { PrismaClient } from '../../src/prisma/generated.js'
import { runReferenceBootstrap } from '../../src/prisma/seedReference.js'
import { seedCmsContent } from '../../src/prisma/seeds/cmsContent.seed.js'
import {
  acquireDatabaseTestAdvisoryLock,
  createDatabaseTestOwnerPool,
  DATABASE_TEST_BOOTSTRAP_FIXTURE_LOCK_ID,
} from './databaseTestClient.js'

const CMS_SEED_TEST_LOCK_ID = 2_026_072_402
const TRIGGER_NAME = 'nce_test_wait_for_cms_seed'
const FUNCTION_NAME = 'nce_test_wait_for_cms_seed'
const ENTRYPOINT_APPLICATION_NAMES = [
  `nce-cms-reference-${process.pid}`,
  `nce-cms-standalone-${process.pid}`,
]
const databaseDescribe =
  process.env.CI === 'true' || process.env.RUN_DATABASE_TESTS === 'true'
    ? describe.sequential
    : describe.skip

async function waitForBlockedCmsSeeds(observer: PoolClient): Promise<void> {
  const deadline = Date.now() + 10_000
  while (Date.now() < deadline) {
    const result = await observer.query<{ waiting: number }>(
      `SELECT count(*)::int AS waiting
       FROM pg_locks locks
       JOIN pg_stat_activity activity ON activity.pid = locks.pid
       WHERE locks.locktype = 'advisory'
         AND locks.objid = $1::oid
         AND NOT locks.granted
         AND activity.application_name = ANY($2::text[])`,
      [CMS_SEED_TEST_LOCK_ID, ENTRYPOINT_APPLICATION_NAMES],
    )
    if (result.rows[0]?.waiting === ENTRYPOINT_APPLICATION_NAMES.length) return
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
  throw new Error('CMS seed entrypoints did not overlap at the insert barrier.')
}

databaseDescribe('CMS seed entrypoint concurrency', () => {
  let fixtureLockPool: Pool
  let releaseFixtureLock: () => Promise<void>

  beforeAll(async () => {
    fixtureLockPool = createDatabaseTestOwnerPool()
    releaseFixtureLock = await acquireDatabaseTestAdvisoryLock(
      fixtureLockPool,
      DATABASE_TEST_BOOTSTRAP_FIXTURE_LOCK_ID,
    )
  }, 45_000)

  afterAll(async () => {
    await releaseFixtureLock?.()
    await fixtureLockPool?.end()
  })

  it('converges reference and standalone CMS entrypoints on one missing page', async () => {
    const observerPool = createDatabaseTestOwnerPool()
    const observer = await observerPool.connect()
    const seedPools = [createDatabaseTestOwnerPool(), createDatabaseTestOwnerPool()]
    seedPools.forEach((pool, index) => {
      pool.options.application_name = ENTRYPOINT_APPLICATION_NAMES[index]
    })
    const seedClients = seedPools.map(
      (pool) => new PrismaClient({ adapter: new PrismaPg(pool) }),
    )
    let lockHeld = false
    let runners: Promise<void>[] = []

    try {
      await observer.query('SELECT pg_advisory_lock($1::bigint)', [CMS_SEED_TEST_LOCK_ID])
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

      runners = [runReferenceBootstrap(seedClients[0]), seedCmsContent(seedClients[1])]
      await waitForBlockedCmsSeeds(observer)
      await observer.query('SELECT pg_advisory_unlock($1::bigint)', [
        CMS_SEED_TEST_LOCK_ID,
      ])
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
          await observer.query('SELECT pg_advisory_unlock($1::bigint)', [
            CMS_SEED_TEST_LOCK_ID,
          ])
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
  }, 30_000)
})
