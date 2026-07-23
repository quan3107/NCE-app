/**
 * File: src/prisma/seeds/navigation.seed.ts
 * Purpose: Run the production-safe permissions and navigation bootstrap subset.
 * Why: The standalone command must preserve managed navigation on every re-run.
 */
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

import { basePrisma, shutdownPrisma } from '../client.js'
import { Prisma } from '../generated.js'
import { REFERENCE_BOOTSTRAP_LOCK_ID } from '../seedReference.js'
import { seedPermissionsAndNavigation } from './referenceBootstrap.seed.js'

export async function seedNavigation(
  prisma: typeof basePrisma = basePrisma,
): Promise<void> {
  await prisma.$transaction(
    async (tx) => {
      await tx.$queryRawUnsafe(
        `SELECT pg_advisory_xact_lock(${REFERENCE_BOOTSTRAP_LOCK_ID})::text AS lock_status`,
      )
      await seedPermissionsAndNavigation(tx)
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      maxWait: 60_000,
      timeout: 60_000,
    },
  )
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  seedNavigation()
    .then(() => console.info('Navigation reference bootstrap complete.'))
    .catch((error) => {
      console.error('Navigation reference bootstrap failed:', error)
      process.exitCode = 1
    })
    .finally(async () => {
      await shutdownPrisma()
    })
}
