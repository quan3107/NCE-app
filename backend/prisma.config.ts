// File: prisma.config.ts
// Purpose: Configure Prisma CLI with schema paths and datasource URLs.
// Why: Prisma 7 moves datasource URLs out of schema.prisma and requires explicit env loading.

import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { config as loadEnv } from 'dotenv'
import { defineConfig, env } from 'prisma/config'

const currentDir = dirname(fileURLToPath(import.meta.url))
// Load backend/.env regardless of where Prisma CLI is invoked.
loadEnv({ path: resolve(currentDir, '.env') })

export default defineConfig({
  schema: 'src/prisma/schema.prisma',
  migrations: {
    path: 'src/prisma/migrations',
  },
  datasource: {
    // Use the direct connection for Prisma CLI operations (migrate/introspect).
    url: env('DIRECT_URL'),
  },
})
