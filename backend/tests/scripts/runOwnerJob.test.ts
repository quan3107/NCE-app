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

  it('uses an explicitly injected owner URL for CI and deployment jobs', async () => {
    const backendDir = await createBackendDirectory()

    await expect(
      loadOwnerDatabaseUrl(backendDir, {
        DIRECT_URL: 'postgresql://ci-owner:owner@localhost:5432/nce',
      }),
    ).resolves.toContain('ci-owner')
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
})
