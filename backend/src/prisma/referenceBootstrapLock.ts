/**
 * File: src/prisma/referenceBootstrapLock.ts
 * Purpose: Serialize production-capable reference seed entrypoints.
 * Why: Overlapping seed commands must not race while restoring shared rows.
 */
import type { basePrisma } from './client.js'
import { Prisma } from './generated.js'

export const REFERENCE_BOOTSTRAP_LOCK_ID = 2_026_072_001

export async function runWithReferenceBootstrapLock<T>(
  prisma: typeof basePrisma,
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(
    async (tx) => {
      // Bound advisory-lock waiting independently so a queued bootstrap retains
      // a full operation budget after it acquires the transaction-scoped lock.
      await tx.$executeRawUnsafe("SET LOCAL lock_timeout = '60s'")
      await tx.$queryRawUnsafe(
        `SELECT pg_advisory_xact_lock(${REFERENCE_BOOTSTRAP_LOCK_ID})::text AS lock_status`,
      )
      await tx.$executeRawUnsafe('SET LOCAL lock_timeout = DEFAULT')
      return operation(tx)
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      maxWait: 60_000,
      timeout: 120_000,
    },
  )
}
