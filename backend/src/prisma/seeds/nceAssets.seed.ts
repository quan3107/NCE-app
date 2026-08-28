/**
 * File: src/prisma/seeds/nceAssets.seed.ts
 * Purpose: Provision protected audio referenced by the local NCE demo seed.
 * Why: Seeded lesson records must never point at absent backing assets.
 */
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { config } from '../../config/env.js'

type SeedEnvironment = { NCE_ASSET_ROOT?: string }

const sourceRoot = fileURLToPath(new URL('./assets', import.meta.url))
const SEEDED_NCE_ASSETS = [
  {
    key: 'nce/book1/lesson1/dialogue.ogg',
    source: 'dialogue.ogg.base64',
    sha256: '26c720066bd8894028aea742fc82cc64d58899e24e4179e0dd1f41df683edffd',
  },
  {
    key: 'nce/book1/lesson2/dictation.ogg',
    source: 'dictation.ogg.base64',
    sha256: '571b6f9b47e24b79f0ae2dc32f03837670ec7299ce8e932f1ce2df165756f153',
  },
] as const

function assetPathWithinRoot(rootPath: string, key: string): string {
  const filePath = path.resolve(rootPath, key)
  const relativePath = path.relative(rootPath, filePath)
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error(`Seeded NCE asset key escapes the configured root: ${key}`)
  }
  return filePath
}

function decodeSeededAsset(source: string, expectedSha256: string): Buffer {
  const encoded = readFileSync(path.resolve(sourceRoot, source), 'utf8')
    .split(/\r?\n/)
    .filter((line) => line.trim() && !line.startsWith('#'))
    .join('')
  const bytes = Buffer.from(encoded, 'base64')
  const actualSha256 = createHash('sha256').update(bytes).digest('hex')
  if (actualSha256 !== expectedSha256) {
    throw new Error(`Seeded NCE asset checksum mismatch: ${source}`)
  }
  return bytes
}

function createAssetIfAbsent(filePath: string, bytes: Buffer): boolean {
  mkdirSync(path.dirname(filePath), { recursive: true })
  try {
    writeFileSync(filePath, bytes, { flag: 'wx', mode: 0o644 })
    return true
  } catch (error) {
    if (
      !error ||
      typeof error !== 'object' ||
      !('code' in error) ||
      error.code !== 'EEXIST'
    ) {
      throw error
    }
    // A concurrent seed or operator may have provisioned the object first.
    // Preserve existing bytes, but reject non-file paths before DB references commit.
    if (!statSync(filePath).isFile()) {
      throw new Error(`Seeded NCE asset path is not a file: ${filePath}`)
    }
    return false
  }
}

export function seedNceAssets(environment: SeedEnvironment = process.env): {
  assets: number
  created: number
  root: string
} {
  const configuredRoot = environment.NCE_ASSET_ROOT ?? config.nceAssets.root
  if (!configuredRoot) {
    throw new Error('NCE asset storage is not configured.')
  }

  const rootPath = path.resolve(configuredRoot)
  let created = 0
  for (const asset of SEEDED_NCE_ASSETS) {
    const bytes = decodeSeededAsset(asset.source, asset.sha256)
    if (createAssetIfAbsent(assetPathWithinRoot(rootPath, asset.key), bytes)) {
      created += 1
    }
  }

  return { assets: SEEDED_NCE_ASSETS.length, created, root: rootPath }
}
