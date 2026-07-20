/**
 * File: src/prisma/seedReference.ts
 * Purpose: Bootstrap required production reference data through one safe command.
 * Why: Deployments need repeatable initialization that excludes demo fixtures.
 */
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

import { basePrisma } from './client.js'
import type { Prisma } from './generated.js'
import { seedIeltsConfig } from './seedIeltsConfig.js'
import { CMS_PAGES } from './seeds/cmsContent.data.js'
import { createPageIfMissing } from './seeds/cmsContent.seed.js'
import { seedCoreReferenceData } from './seeds/referenceBootstrap.seed.js'

export async function bootstrapReferenceData(
  prisma: Prisma.TransactionClient,
): Promise<void> {
  await seedCoreReferenceData(prisma)
  await seedIeltsConfig(prisma)
  for (const page of CMS_PAGES) await createPageIfMissing(prisma, page)
}

async function main(): Promise<void> {
  console.info('Bootstrapping required production reference data...')
  await basePrisma.$transaction(bootstrapReferenceData, { timeout: 60_000 })
  console.info('Production reference bootstrap complete.')
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main()
    .catch((error) => {
      console.error('Reference bootstrap failed:', error)
      process.exitCode = 1
    })
    .finally(async () => {
      await basePrisma.$disconnect()
    })
}
