/**
 * File: scripts/runDemoSeed.ts
 * Purpose: Gate the destructive demo fixture seed behind exact local confirmation.
 * Why: Owner credentials alone must never authorize deleting production-owned data.
 */
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { isLoopbackDatabaseUrl } from './databaseConnectionPolicy.js'

type DemoSeedEnvironment = NodeJS.ProcessEnv

function databaseName(connectionString: string): string {
  return decodeURIComponent(new URL(connectionString).pathname.replace(/^\/+/, ''))
}

export function assertDemoSeedTarget(
  environment: DemoSeedEnvironment = process.env,
): void {
  const connectionString = environment.DATABASE_URL?.trim()
  if (!connectionString) {
    throw new Error('DATABASE_URL is required for the demo seed.')
  }
  if (environment.NODE_ENV === 'production') {
    throw new Error('Refusing to run the demo seed in production mode.')
  }
  if (!isLoopbackDatabaseUrl(connectionString)) {
    throw new Error('Demo seed is restricted to a loopback database.')
  }

  const targetDatabase = databaseName(connectionString)
  const confirmation = environment.DEMO_SEED_CONFIRM_DATABASE?.trim()
  if (!targetDatabase || confirmation !== targetDatabase) {
    throw new Error(
      `Set DEMO_SEED_CONFIRM_DATABASE=${targetDatabase || '<database-name>'} to confirm the exact disposable local target.`,
    )
  }
}

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
