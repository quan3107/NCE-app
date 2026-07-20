/**
 * File: src/prisma/seeds/navigation.seed.ts
 * Purpose: Run the production-safe permissions and navigation bootstrap subset.
 * Why: The standalone command must preserve managed navigation on every re-run.
 */
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

import { basePrisma } from '../client.js'
import { seedPermissionsAndNavigation } from './referenceBootstrap.seed.js'

export async function seedNavigation(): Promise<void> {
  await basePrisma.$transaction(seedPermissionsAndNavigation)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  seedNavigation()
    .then(() => console.info('Navigation reference bootstrap complete.'))
    .catch((error) => {
      console.error('Navigation reference bootstrap failed:', error)
      process.exitCode = 1
    })
    .finally(async () => {
      await basePrisma.$disconnect()
    })
}
