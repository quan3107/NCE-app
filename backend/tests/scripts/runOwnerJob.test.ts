/**
 * File: tests/scripts/runOwnerJob.test.ts
 * Purpose: Lock owner-only command environment scoping.
 * Why: Local migrations and seeds must read .env.local without exposing it to runtime.
 */
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

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

  it('forwards the approved CA path from the local ignored environment file', async () => {
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
    }
    const ownerDatabaseUrl = 'postgresql://owner:owner@localhost:5432/nce'

    expect(buildOwnerJobEnvironment(parentEnvironment, ownerDatabaseUrl)).toEqual({
      ...parentEnvironment,
      DATABASE_URL: ownerDatabaseUrl,
      DIRECT_URL: ownerDatabaseUrl,
    })
    expect(parentEnvironment).not.toHaveProperty('DIRECT_URL')
  })

  it('adds a configured CA path only to the short-lived child environment', () => {
    const parentEnvironment = {}
    const childEnvironment = buildOwnerJobEnvironment(
      parentEnvironment,
      'postgresql://owner:owner@db.example.com:5432/nce',
      '/trusted/project-ca.crt',
    )

    expect(childEnvironment.DIRECT_DATABASE_CA_CERT_PATH).toBe('/trusted/project-ca.crt')
    expect(parentEnvironment).not.toHaveProperty('DIRECT_DATABASE_CA_CERT_PATH')
  })
})
