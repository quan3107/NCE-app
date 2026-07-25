/**
 * File: src/prisma/demoSeedPolicy.ts
 * Purpose: Gate destructive demo fixtures behind exact local confirmation.
 * Why: Every executable seed path must fail closed before resetting data.
 */
import { Client } from 'pg'

import { isLoopbackDatabaseUrl } from '../databaseConnectionPolicy.js'

type DemoSeedEnvironment = NodeJS.ProcessEnv

function databaseTarget(connectionString: string): {
  database: string
  port: number
} {
  const client = new Client({ connectionString })
  return {
    database: client.database ?? '',
    port: client.port,
  }
}

export function assertDemoSeedTarget(
  environment: DemoSeedEnvironment = process.env,
): void {
  const connectionString = environment.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL is required for the demo seed.')
  }
  // Validate the exact string passed to node-postgres so confirmation cannot
  // describe a normalized target while the driver consumes a different one.
  if (connectionString !== connectionString.trim()) {
    throw new Error('DATABASE_URL must not contain surrounding whitespace.')
  }
  if (environment.NODE_ENV !== 'development' && environment.NODE_ENV !== 'test') {
    throw new Error('Demo seed requires explicit development or test mode.')
  }
  let databaseUrl: URL
  try {
    databaseUrl = new URL(connectionString)
  } catch {
    throw new Error('DATABASE_URL is invalid for the demo seed.')
  }
  if (databaseUrl.protocol !== 'postgres:' && databaseUrl.protocol !== 'postgresql:') {
    throw new Error('DATABASE_URL must use a postgres: or postgresql: URL.')
  }
  if (!isLoopbackDatabaseUrl(connectionString)) {
    throw new Error('Demo seed is restricted to a loopback database.')
  }

  const target = databaseTarget(connectionString)
  const targetDatabase = target.database
  const confirmation = environment.DEMO_SEED_CONFIRM_DATABASE
  if (!targetDatabase || confirmation !== targetDatabase) {
    throw new Error(
      `Set DEMO_SEED_CONFIRM_DATABASE=${targetDatabase || '<database-name>'} to confirm the exact disposable local target.`,
    )
  }
  const authorityPort = databaseUrl.port ? Number.parseInt(databaseUrl.port, 10) : 5432
  // Match the server named by the URL authority; query parameters and ambient
  // node-postgres settings must not redirect a direct seed to another server.
  if (target.port !== authorityPort) {
    throw new Error('DATABASE_URL must not override its authority port.')
  }
}
