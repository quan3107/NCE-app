/**
 * File: tests/prisma/databaseTestClient.test.ts
 * Purpose: Verify authenticated TLS policy for administrative database tests.
 * Why: Remote rehearsal clients must share the owner launcher connection boundary.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { Client } from 'pg'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  createDatabaseTestOwnerPool,
  requireDatabaseTestOwnerUrl,
  requireRawDatabaseTestOwnerUrl,
} from './databaseTestClient.js'

const entrypointTest = readFileSync(
  resolve(process.cwd(), 'tests/prisma/referenceBootstrap.entrypoint.database.test.ts'),
  'utf8',
)
const runtimeRoleTest = readFileSync(
  resolve(process.cwd(), 'tests/server.runtimeRoles.database.test.ts'),
  'utf8',
)
const packageJson = JSON.parse(
  readFileSync(resolve(process.cwd(), 'package.json'), 'utf8'),
) as {
  scripts: Record<string, string>
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('database test owner connection', () => {
  it.each([
    'postgresql://owner:secret@localhost:5432/nce_test',
    'postgresql://owner:secret@127.0.0.1:5432/nce_test',
    'postgresql://owner:secret@[::1]:5432/nce_test',
  ])('leaves loopback URL unchanged: %s', (databaseUrl) => {
    expect(
      requireDatabaseTestOwnerUrl({
        DIRECT_URL: databaseUrl,
        DIRECT_DATABASE_CA_CERT_PATH: '/unused/project-ca.crt',
      }),
    ).toBe(databaseUrl)
  })

  it('adds CA-backed hostname verification to a remote owner URL', () => {
    const certificatePath = resolve('/trusted/project-ca.crt')
    const result = requireDatabaseTestOwnerUrl({
      DIRECT_URL: 'postgresql://owner:secret@db.example.com:5432/nce_test',
      DIRECT_DATABASE_CA_CERT_PATH: certificatePath,
    })
    const url = new URL(result)

    expect(url.searchParams.get('sslmode')).toBe('verify-full')
    expect(url.searchParams.get('sslrootcert')).toBe(certificatePath)
  })

  it('uses PostgreSQL port 5432 when the validated URL omits its port', async () => {
    vi.stubEnv('PGPORT', '6543')
    const pool = createDatabaseTestOwnerPool({
      DIRECT_URL: 'postgresql://owner:secret@localhost/nce_test',
      PGPORT: '6543',
    })

    try {
      const client = new Client(pool.options)
      const effectivePort = (
        client as unknown as { connectionParameters: { port: number } }
      ).connectionParameters.port

      expect(effectivePort).toBe(5432)
    } finally {
      await pool.end()
    }
  })

  it('rejects remote URLs without a CA or with conflicting SSL options', () => {
    expect(() =>
      requireDatabaseTestOwnerUrl({
        DIRECT_URL: 'postgresql://owner:secret@db.example.com:5432/nce_test',
      }),
    ).toThrow(/require DIRECT_DATABASE_CA_CERT_PATH/)
    expect(() =>
      requireDatabaseTestOwnerUrl({
        DIRECT_URL:
          'postgresql://owner:secret@db.example.com:5432/nce_test?sslmode=require',
        DIRECT_DATABASE_CA_CERT_PATH: '/trusted/project-ca.crt',
      }),
    ).toThrow(/must not set SSL options/)
  })

  it.each([
    'postgresql://owner:secret@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres',
    'postgresql://owner:secret@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres',
    'postgresql://owner:secret@db.abcdefghijklmnopqrst.supabase.co:6543/postgres',
    'postgresql://owner:secret@db.abcdefghijklmnopqrst.supabase.co.:6543/postgres',
    'postgresql://owner:secret@aws-0-ap-southeast-1.pooler.supabase.com.:6543/postgres',
    'postgresql://owner:secret@db.abcdefghijklmnopqrst.supabase.co:9999/postgres',
  ])('rejects pooled Supabase database-test endpoints: %s', (directUrl) => {
    expect(() =>
      requireDatabaseTestOwnerUrl({
        DIRECT_URL: directUrl,
        DIRECT_DATABASE_CA_CERT_PATH: '/trusted/project-ca.crt',
      }),
    ).toThrow(/direct Supabase database endpoint.*port 5432/i)
  })

  it('rejects a pooled database-test endpoint hidden by query overrides', () => {
    expect(() =>
      requireDatabaseTestOwnerUrl({
        DIRECT_URL:
          'postgresql://owner:secret@db.abcdefghijklmnopqrst.supabase.co:5432/postgres?host=aws-0-ap-southeast-1.pooler.supabase.com&port=6543',
        DIRECT_DATABASE_CA_CERT_PATH: '/trusted/project-ca.crt',
      }),
    ).toThrow(/must not set host or port query overrides/i)
  })

  it('keeps the exact seed command on the raw URL and owner launcher', () => {
    const rawUrl = 'postgresql://owner:secret@db.example.com:5432/nce_test'

    expect(requireRawDatabaseTestOwnerUrl({ DIRECT_URL: rawUrl })).toBe(rawUrl)
    expect(packageJson.scripts['seed:reference']).toContain('scripts/runOwnerJob.ts')
    expect(entrypointTest).toContain('DIRECT_URL: requireRawDatabaseTestOwnerUrl()')
    expect(entrypointTest).toContain('createDatabaseTestOwnerPool()')
    expect(entrypointTest).toContain('application_name')
    expect(entrypointTest).toContain('pg_stat_activity')
    expect(entrypointTest).toContain('activity.application_name')
    expect(runtimeRoleTest).toContain('createDatabaseTestOwnerPool()')
  })
})
