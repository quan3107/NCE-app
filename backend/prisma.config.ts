// File: prisma.config.ts
// Purpose: Configure Prisma CLI with schema paths and datasource URLs.
// Why: Prisma 7 moves datasource URLs out of schema.prisma and requires explicit env loading.

import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { config as loadEnv } from 'dotenv'
import { defineConfig } from 'prisma/config'

import { applyBackendTestEnvDefaults } from './tests/setup/testEnvDefaults.js'

const currentDir = dirname(fileURLToPath(import.meta.url))

if (process.env.NODE_ENV === 'test') {
  applyBackendTestEnvDefaults()
}

// Load backend/.env regardless of where Prisma CLI is invoked.
loadEnv({ path: resolve(currentDir, '.env'), quiet: process.env.NODE_ENV === 'test' })

// Prisma 7 moved datasource URLs out of schema.prisma into this config.
// DIRECT_URL is for Prisma CLI operations (migrate/introspect) and typically
// points to a direct database connection without PgBouncer. Fall back to
// DATABASE_URL when DIRECT_URL is not set (e.g. local dev without PgBouncer).
const directUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL
if (!directUrl) {
  throw new Error('DIRECT_URL or DATABASE_URL must be set in environment.')
}

export default defineConfig({
  schema: 'src/prisma/schema.prisma',
  migrations: {
    path: 'src/prisma/migrations',
  },
  datasource: {
    url: directUrl,
  },
})
