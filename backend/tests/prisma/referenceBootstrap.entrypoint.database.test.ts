/**
 * File: tests/prisma/referenceBootstrap.entrypoint.database.test.ts
 * Purpose: Exercise serialized bootstrap entrypoints without mutating reference rows.
 * Why: Deployment concurrency and command shutdown need real PostgreSQL boundaries.
 */
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

import { PrismaPg } from '@prisma/adapter-pg'
import type { Pool } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { PrismaClient } from '../../src/prisma/generated.js'
import {
  REFERENCE_BOOTSTRAP_LOCK_ID,
  bootstrapReferenceData,
  runReferenceBootstrap,
} from '../../src/prisma/seedReference.js'
import { runIeltsConfigSeed } from '../../src/prisma/seedIeltsConfig.js'
import { seedNavigation } from '../../src/prisma/seeds/navigation.seed.js'
import {
  acquireDatabaseTestAdvisoryLock,
  createDatabaseTestOwnerPool,
  DATABASE_TEST_BOOTSTRAP_FIXTURE_LOCK_ID,
  requireRawDatabaseTestOwnerUrl,
} from './databaseTestClient.js'

const execFileAsync = promisify(execFile)
const ENTRYPOINT_APPLICATION_NAME = `nce-reference-entrypoint-${process.pid}`
const databaseDescribe =
  process.env.CI === 'true' &&
  process.env.RUN_REFERENCE_BOOTSTRAP_ENTRYPOINT_TEST === 'true'
    ? describe.sequential
    : describe.skip

async function waitingLockCount(client: PrismaClient): Promise<number> {
  const [result] = await client.$queryRaw<Array<{ waiting: number }>>`
    SELECT count(*)::int AS waiting
    FROM pg_locks locks
    JOIN pg_stat_activity activity ON activity.pid = locks.pid
    WHERE locks.locktype = 'advisory'
      AND locks.classid = 0
      AND locks.objid = ${REFERENCE_BOOTSTRAP_LOCK_ID}
      AND NOT locks.granted
      AND activity.application_name = ${ENTRYPOINT_APPLICATION_NAME}
  `
  return result.waiting
}

function createEntrypointPool() {
  const pool = createDatabaseTestOwnerPool()
  pool.options.application_name = ENTRYPOINT_APPLICATION_NAME
  return pool
}

async function waitForWaitingLocks(
  client: PrismaClient,
  expectedCount: number,
): Promise<void> {
  const deadline = Date.now() + 5_000
  while (Date.now() < deadline) {
    if ((await waitingLockCount(client)) === expectedCount) return
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
  throw new Error('Bootstrap entrypoints did not wait for the advisory lock.')
}

async function assertBootstrapIsStable(client: PrismaClient): Promise<void> {
  let mutations = -1
  await expect(
    client.$transaction(async (tx) => {
      await bootstrapReferenceData(tx)
      const [result] = await tx.$queryRawUnsafe<Array<{ mutations: number }>>(`
        SELECT coalesce(sum(n_tup_ins + n_tup_upd + n_tup_del), 0)::int AS mutations
        FROM pg_stat_xact_user_tables
      `)
      mutations = result.mutations
      throw new Error('ROLLBACK_BOOTSTRAP_STABILITY_PROBE')
    }),
  ).rejects.toThrow('ROLLBACK_BOOTSTRAP_STABILITY_PROBE')
  expect(mutations, 'entrypoint target must be reference-bootstrapped').toBe(0)
}

databaseDescribe('production reference bootstrap entrypoint', () => {
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

  it('runs the exact reference seed command and exits promptly', async () => {
    const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
    const result = await execFileAsync(npm, ['run', 'seed:reference'], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        DIRECT_URL: requireRawDatabaseTestOwnerUrl(),
      },
      timeout: 8_000,
    })

    expect(result.stdout).toContain('Production reference bootstrap complete.')
  }, 10_000)

  it('serializes reference, navigation, and IELTS entrypoints', async () => {
    const pools = Array.from({ length: 4 }, createEntrypointPool)
    const clients = pools.map((pool) => new PrismaClient({ adapter: new PrismaPg(pool) }))
    let releaseLock = () => undefined
    const releasePromise = new Promise<void>((resolve) => {
      releaseLock = resolve
    })
    let signalLockAcquired = () => undefined
    const lockAcquired = new Promise<void>((resolve) => {
      signalLockAcquired = resolve
    })
    let blocker: Promise<void> | undefined
    let runners: Promise<void>[] = []

    try {
      await assertBootstrapIsStable(clients[0])
      const navigationCount = await clients[0].navigationItem.count()
      blocker = clients[3].$transaction(async (tx) => {
        await tx.$queryRawUnsafe(
          `SELECT pg_advisory_xact_lock(${REFERENCE_BOOTSTRAP_LOCK_ID})::text`,
        )
        signalLockAcquired()
        await releasePromise
      })
      await lockAcquired
      runners = [
        runReferenceBootstrap(clients[0]),
        seedNavigation(clients[1]),
        runIeltsConfigSeed(clients[2]),
      ]
      await waitForWaitingLocks(clients[3], runners.length)
      releaseLock()
      await Promise.all([blocker, ...runners])

      await expect(clients[0].navigationItem.count()).resolves.toBe(navigationCount)
    } finally {
      releaseLock()
      await Promise.allSettled([...(blocker ? [blocker] : []), ...runners])
      await Promise.allSettled(clients.map((client) => client.$disconnect()))
      await Promise.all(pools.map((pool) => pool.end()))
    }
  }, 20_000)
})
