/**
 * File: src/prisma/demoSeedPolicy.ts
 * Purpose: Gate destructive demo fixtures behind exact local confirmation.
 * Why: Every executable seed path must fail closed before resetting data.
 */
import { isLoopbackDatabaseUrl } from '../databaseConnectionPolicy.js'

type DemoSeedEnvironment = NodeJS.ProcessEnv

function databaseName(connectionString: string): string {
  return decodeURI(new URL(connectionString).pathname.slice(1))
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
  try {
    new URL(connectionString)
  } catch {
    throw new Error('DATABASE_URL is invalid for the demo seed.')
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
