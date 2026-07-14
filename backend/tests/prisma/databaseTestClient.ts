/**
 * File: tests/prisma/databaseTestClient.ts
 * Purpose: Run administrative database fixtures through the migration login.
 * Why: Upgrade tests must mutate schema-owned tables without broadening the runtime role.
 */
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

import { Prisma, PrismaClient } from '../../src/prisma/generated.js'

export function requireDatabaseTestOwnerUrl(): string {
  const directUrl = process.env.DIRECT_URL
  if (!directUrl) {
    throw new Error('DIRECT_URL is required for administrative database tests.')
  }

  return directUrl
}

export async function runDatabaseTestTransaction<T>(
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  const databaseUrl = requireDatabaseTestOwnerUrl()
  const pool = new Pool({ connectionString: databaseUrl })
  const client = new PrismaClient({ adapter: new PrismaPg(pool) })

  try {
    return await client.$transaction(operation, { timeout: 15_000 })
  } finally {
    await client.$disconnect()
    await pool.end()
  }
}
