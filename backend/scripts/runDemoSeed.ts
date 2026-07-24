/**
 * File: scripts/runDemoSeed.ts
 * Purpose: Gate the destructive demo fixture seed behind exact local confirmation.
 * Why: Owner credentials alone must never authorize deleting production-owned data.
 */
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { assertDemoSeedTarget } from '../src/prisma/demoSeedPolicy.js'

export { assertDemoSeedTarget } from '../src/prisma/demoSeedPolicy.js'

async function main(): Promise<void> {
  assertDemoSeedTarget()
  await import('../src/prisma/seed.js')
}

const scriptPath = fileURLToPath(import.meta.url)
if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
