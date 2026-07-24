/**
 * File: tests/scripts/runOwnerJob.test.ts
 * Purpose: Lock owner-only command environment scoping.
 * Why: Local migrations and seeds must read .env.local without exposing it to runtime.
 */
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'
import { Client } from 'pg'

import {
  buildOwnerJobEnvironment,
  loadOwnerConfig,
  loadOwnerDatabaseUrl,
} from '../../scripts/runOwnerJob.js'

const temporaryDirectories: string[] = []

async function createBackendDirectory() {
  const directory = await mkdtemp(join(tmpdir(), 'nce-owner-job-'))
  temporaryDirectories.push(directory)
  return directory
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  )
})

describe('owner job environment', () => {
  it('loads the owner URL from the local ignored environment file', async () => {
    const backendDir = await createBackendDirectory()
    await writeFile(
      join(backendDir, '.env.local'),
      'DIRECT_URL=postgresql://owner:owner@localhost:5432/nce\n',
    )

    await expect(loadOwnerDatabaseUrl(backendDir, {})).resolves.toBe(
      'postgresql://owner:owner@localhost:5432/nce',
    )
  })

  it('loads the approved CA path from the local ignored environment file', async () => {
    const backendDir = await createBackendDirectory()
    await writeFile(
      join(backendDir, '.env.local'),
      [
        'DIRECT_URL=postgresql://owner:owner@db.example.com:5432/nce',
        'DIRECT_DATABASE_CA_CERT_PATH=/trusted/project-ca.crt',
      ].join('\n'),
    )

    await expect(loadOwnerConfig(backendDir, {})).resolves.toEqual({
      databaseUrl: 'postgresql://owner:owner@db.example.com:5432/nce',
      certificateAuthorityPath: '/trusted/project-ca.crt',
    })
  })

  it('uses an explicitly injected owner URL for CI and deployment jobs', async () => {
    const backendDir = await createBackendDirectory()

    await expect(
      loadOwnerDatabaseUrl(backendDir, {
        DIRECT_URL: 'postgresql://ci-owner:owner@localhost:5432/nce',
      }),
    ).resolves.toContain('ci-owner')
  })

  it('preserves an explicitly injected CA path for CI and deployment jobs', async () => {
    const backendDir = await createBackendDirectory()
    await writeFile(
      join(backendDir, '.env.local'),
      [
        'DIRECT_URL=postgresql://owner:owner@db.example.com:5432/nce',
        'DIRECT_DATABASE_CA_CERT_PATH=/local/project-ca.crt',
      ].join('\n'),
    )

    await expect(
      loadOwnerConfig(backendDir, {
        DIRECT_DATABASE_CA_CERT_PATH: '/injected/project-ca.crt',
      }),
    ).resolves.toEqual({
      databaseUrl: 'postgresql://owner:owner@db.example.com:5432/nce',
      certificateAuthorityPath: '/injected/project-ca.crt',
    })
  })

  it('keeps local owner jobs CA-free when no hosted CA is configured', async () => {
    const backendDir = await createBackendDirectory()
    await writeFile(
      join(backendDir, '.env.local'),
      'DIRECT_URL=postgresql://owner:owner@localhost:5432/nce\n',
    )

    const ownerConfig = await loadOwnerConfig(backendDir, {})
    expect(ownerConfig.certificateAuthorityPath).toBeUndefined()
    expect(buildOwnerJobEnvironment({}, ownerConfig.databaseUrl)).not.toHaveProperty(
      'DIRECT_DATABASE_CA_CERT_PATH',
    )
  })

  it('fails clearly when no owner URL is available', async () => {
    const backendDir = await createBackendDirectory()

    await expect(loadOwnerDatabaseUrl(backendDir, {})).rejects.toThrow(
      'Owner database URL is missing',
    )
  })

  it('scopes owner credentials to the child environment', () => {
    const parentEnvironment = {
      DATABASE_URL: 'postgresql://runtime:runtime@localhost:5432/nce',
      JOB_DATABASE_URL: 'postgresql://worker:worker@localhost:5432/nce',
      NODE_TLS_REJECT_UNAUTHORIZED: '0',
      PGDATABASE: 'ambient_database',
      PGHOST: 'ambient.example.com',
      PGPASSWORD: 'ambient_password',
      PGPORT: '6543',
      PGOPTIONS: '-c default_transaction_read_only=on',
      PGUSER: 'ambient_user',
    }
    const ownerDatabaseUrl = 'postgresql://owner:owner@localhost/nce'

    expect(buildOwnerJobEnvironment(parentEnvironment, ownerDatabaseUrl)).toEqual({
      JOB_DATABASE_URL: parentEnvironment.JOB_DATABASE_URL,
      DATABASE_URL: ownerDatabaseUrl,
      DIRECT_URL: ownerDatabaseUrl,
    })
    expect(parentEnvironment).not.toHaveProperty('DIRECT_URL')
  })

  it.each(['postgresql://localhost:5432/nce', 'postgresql://owner:owner@localhost:5432'])(
    'rejects an owner URL without an explicit user and database: %s',
    (url) => {
      expect(() => buildOwnerJobEnvironment({}, url)).toThrow(
        /explicit user and database/,
      )
    },
  )

  it('gives Prisma owner commands a strict CA-backed TLS URL', () => {
    const childEnvironment = buildOwnerJobEnvironment(
      {},
      'postgresql://owner:owner@db.example.com:5432/nce',
      '/trusted/project-ca.crt',
      'prisma',
    )
    const url = new URL(childEnvironment.DATABASE_URL ?? '')

    expect(url.searchParams.get('sslmode')).toBe('require')
    expect(url.searchParams.get('sslaccept')).toBe('strict')
    expect(url.searchParams.get('sslcert')).toMatch(/project-ca\.crt$/)
    expect(url.searchParams.has('sslrootcert')).toBe(false)
    expect(childEnvironment.DIRECT_URL).toBe(childEnvironment.DATABASE_URL)
  })

  it('gives node-postgres owner commands verified CA and hostname TLS', async () => {
    const backendDir = await createBackendDirectory()
    const certificatePath = join(backendDir, 'project-ca.crt')
    await writeFile(certificatePath, 'trusted-project-ca')
    const childEnvironment = buildOwnerJobEnvironment(
      { DIRECT_DATABASE_CA_CERT_PATH: certificatePath },
      'postgresql://owner:owner@db.example.com:5432/nce',
      certificatePath,
      'tsx',
    )
    const url = new URL(childEnvironment.DATABASE_URL ?? '')
    const client = new Client({ connectionString: childEnvironment.DATABASE_URL })
    const ssl = (
      client as unknown as {
        connectionParameters: {
          ssl: false | { ca?: string; rejectUnauthorized?: boolean }
        }
      }
    ).connectionParameters.ssl

    expect(url.searchParams.get('sslmode')).toBe('verify-full')
    expect(url.searchParams.get('sslrootcert')).toBe(certificatePath)
    expect(ssl).toMatchObject({ ca: 'trusted-project-ca' })
    expect(ssl).not.toMatchObject({ rejectUnauthorized: false })
    expect(childEnvironment).not.toHaveProperty('DIRECT_DATABASE_CA_CERT_PATH')
  })

  it('rejects unverified or conflicting remote owner configuration', () => {
    expect(() =>
      buildOwnerJobEnvironment({}, 'postgresql://owner:owner@db.example.com:5432/nce'),
    ).toThrow(/require DIRECT_DATABASE_CA_CERT_PATH/)
    expect(() =>
      buildOwnerJobEnvironment(
        {},
        'postgresql://owner:owner@db.example.com:5432/nce?sslmode=disable',
        '/trusted/project-ca.crt',
      ),
    ).toThrow(/must not set SSL options/)
  })

  it.each([
    'postgresql://owner:secret@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres',
    'postgresql://owner:secret@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres',
    'postgresql://owner:secret@db.abcdefghijklmnopqrst.supabase.co:6543/postgres',
    'postgresql://owner:secret@db.abcdefghijklmnopqrst.supabase.co.:6543/postgres',
    'postgresql://owner:secret@aws-0-ap-southeast-1.pooler.supabase.com.:6543/postgres',
    'postgresql://owner:secret@db.abcdefghijklmnopqrst.supabase.co:9999/postgres',
  ])('rejects pooled Supabase owner endpoints: %s', (ownerDatabaseUrl) => {
    expect(() =>
      buildOwnerJobEnvironment({}, ownerDatabaseUrl, '/trusted/project-ca.crt', 'prisma'),
    ).toThrow(/direct Supabase database endpoint.*port 5432/i)
  })

  it('rejects a pooled Supabase endpoint hidden by host and port overrides', () => {
    expect(() =>
      buildOwnerJobEnvironment(
        {},
        'postgresql://owner:secret@db.abcdefghijklmnopqrst.supabase.co:5432/postgres?host=aws-0-ap-southeast-1.pooler.supabase.com&port=6543',
        '/trusted/project-ca.crt',
        'tsx',
      ),
    ).toThrow(/must not set host or port query overrides/i)
  })

  it('rejects ambiguous driver host overrides', () => {
    expect(() =>
      buildOwnerJobEnvironment(
        {},
        'postgresql://owner:owner@localhost:5432/nce?host=db.example.com',
      ),
    ).toThrow(/must not set host or port query overrides/i)
  })

  it('keeps bracketed IPv6 loopback CA-free', () => {
    const ownerDatabaseUrl = 'postgresql://owner:owner@[::1]:5432/nce'
    const childEnvironment = buildOwnerJobEnvironment(
      { DIRECT_DATABASE_CA_CERT_PATH: '/irrelevant/missing-ca.crt' },
      ownerDatabaseUrl,
    )

    expect(childEnvironment.DATABASE_URL).toBe(ownerDatabaseUrl)
    expect(childEnvironment).not.toHaveProperty('DIRECT_DATABASE_CA_CERT_PATH')
  })
})
