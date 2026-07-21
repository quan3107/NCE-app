/**
 * File: tests/prisma/referenceBootstrap.entrypoint.database.test.ts
 * Purpose: Exercise serialized bootstrap entrypoints without mutating reference rows.
 * Why: Deployment concurrency and command shutdown need real PostgreSQL boundaries.
 */
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { describe, expect, it } from 'vitest'

import { PrismaClient } from '../../src/prisma/generated.js'
import {
  REFERENCE_BOOTSTRAP_LOCK_ID,
  bootstrapReferenceData,
  runReferenceBootstrap,
} from '../../src/prisma/seedReference.js'
import { requireDatabaseTestOwnerUrl } from './databaseTestClient.js'

const execFileAsync = promisify(execFile)
const databaseDescribe =
  (process.env.CI === 'true' || process.env.RUN_DATABASE_TESTS === 'true') &&
  process.env.RUN_REFERENCE_BOOTSTRAP_ENTRYPOINT_TEST === 'true'
    ? describe
    : describe.skip

async function waitingLockCount(client: PrismaClient): Promise<number> {
  const [result] = await client.$queryRawUnsafe<Array<{ waiting: number }>>(`
    SELECT count(*)::int AS waiting
    FROM pg_locks
    WHERE locktype = 'advisory'
      AND classid = 0
      AND objid = ${REFERENCE_BOOTSTRAP_LOCK_ID}
      AND NOT granted
  `)
  return result.waiting
}

async function waitForWaitingLocks(client: PrismaClient): Promise<void> {
  const deadline = Date.now() + 5_000
  while (Date.now() < deadline) {
    if ((await waitingLockCount(client)) === 2) return
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
  it('serializes two independent clients without mutating reference data', async () => {
    const pools = Array.from(
      { length: 3 },
      () => new Pool({ connectionString: requireDatabaseTestOwnerUrl() }),
    )
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
      blocker = clients[2].$transaction(async (tx) => {
        await tx.$queryRawUnsafe(
          `SELECT pg_advisory_xact_lock(${REFERENCE_BOOTSTRAP_LOCK_ID})::text`,
        )
        signalLockAcquired()
        await releasePromise
      })
      await lockAcquired
      runners = clients.slice(0, 2).map((client) => runReferenceBootstrap(client))
      await waitForWaitingLocks(clients[2])
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

  it('runs the exact reference seed command and exits promptly', async () => {
    const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
    const result = await execFileAsync(npm, ['run', 'seed:reference'], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        DIRECT_URL: requireDatabaseTestOwnerUrl(),
      },
      timeout: 8_000,
    })

    expect(result.stdout).toContain('Production reference bootstrap complete.')
  }, 10_000)
})
