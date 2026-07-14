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

// Owner-only commands must never silently run through the least-privilege
// runtime login. Package scripts inject DIRECT_URL only into their child process.
const prismaArguments = process.argv.slice(2)
const databaseCommand = prismaArguments.indexOf('db')
const requiresOwner =
  prismaArguments.includes('migrate') ||
  prismaArguments.includes('introspect') ||
  (databaseCommand >= 0 &&
    ['execute', 'pull', 'push', 'seed'].includes(
      prismaArguments[databaseCommand + 1] ?? '',
    ))

const directUrl = process.env.DIRECT_URL
if (requiresOwner && !directUrl) {
  throw new Error(
    'DIRECT_URL is required for Prisma migration commands. Use an owner-scoped npm script.',
  )
}

const datasourceUrl = directUrl ?? process.env.DATABASE_URL
if (!datasourceUrl) {
  throw new Error('DATABASE_URL is required for Prisma generate and validate commands.')
}

export default defineConfig({
  schema: 'src/prisma/schema.prisma',
  migrations: {
    path: 'src/prisma/migrations',
  },
  datasource: {
    url: datasourceUrl,
  },
})
