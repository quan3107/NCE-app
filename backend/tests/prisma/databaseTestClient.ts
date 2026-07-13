/**
 * File: tests/prisma/databaseTestClient.ts
 * Purpose: Run administrative database fixtures through the migration login.
 * Why: Upgrade tests must mutate schema-owned tables without broadening the runtime role.
 */
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

import { Prisma, PrismaClient } from '../../src/prisma/generated.js'

const databaseUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL
if (!databaseUrl) {
  throw new Error('DIRECT_URL or DATABASE_URL must be set for database tests.')
}

export async function runDatabaseTestTransaction<T>(
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  const pool = new Pool({ connectionString: databaseUrl })
  const client = new PrismaClient({ adapter: new PrismaPg(pool) })

  try {
    return await client.$transaction(operation, { timeout: 15_000 })
  } finally {
    await client.$disconnect()
    await pool.end()
  }
}
