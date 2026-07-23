/**
 * File: tests/prisma/databaseTestClient.ts
 * Purpose: Run administrative database fixtures through the migration login.
 * Why: Upgrade tests must mutate schema-owned tables without broadening the runtime role.
 */
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

import { buildOwnerConnectionUrl } from '../../scripts/runOwnerJob.js'
import { Prisma, PrismaClient } from '../../src/prisma/generated.js'

export function requireRawDatabaseTestOwnerUrl(
  environment: NodeJS.ProcessEnv = process.env,
): string {
  const directUrl = environment.DIRECT_URL?.trim()
  if (!directUrl) {
    throw new Error('DIRECT_URL is required for administrative database tests.')
  }

  return directUrl
}

export function requireDatabaseTestOwnerUrl(
  environment: NodeJS.ProcessEnv = process.env,
): string {
  return buildOwnerConnectionUrl(
    requireRawDatabaseTestOwnerUrl(environment),
    environment.DIRECT_DATABASE_CA_CERT_PATH?.trim(),
    'tsx',
  )
}

export function createDatabaseTestOwnerPool(
  environment: NodeJS.ProcessEnv = process.env,
): Pool {
  const connectionUrl = new URL(requireDatabaseTestOwnerUrl(environment))

  // Pin PostgreSQL's default in the URL so its parser cannot inherit PGPORT.
  if (!connectionUrl.port) connectionUrl.port = '5432'
  return new Pool({ connectionString: connectionUrl.toString() })
}

export async function runDatabaseTestTransaction<T>(
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  const pool = createDatabaseTestOwnerPool()
  const client = new PrismaClient({ adapter: new PrismaPg(pool) })

  try {
    return await client.$transaction(operation, { timeout: 15_000 })
  } finally {
    await client.$disconnect()
    await pool.end()
  }
}
