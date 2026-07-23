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
      await tx.$queryRawUnsafe(
        `SELECT pg_advisory_xact_lock(${REFERENCE_BOOTSTRAP_LOCK_ID})::text AS lock_status`,
      )
      return operation(tx)
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      maxWait: 60_000,
      timeout: 60_000,
    },
  )
}
