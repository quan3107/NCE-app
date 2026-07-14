/**
 * File: scripts/runOwnerJob.ts
 * Purpose: Run approved database-owner tools with a short-lived child environment.
 * Why: Local migrations and seeds need .env.local without exposing DIRECT_URL to runtime.
 */
import { spawn } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { parse } from 'dotenv'

const require = createRequire(import.meta.url)
const scriptPath = fileURLToPath(import.meta.url)
const backendDir = resolve(dirname(scriptPath), '..')
const supportedTools = new Set(['prisma', 'tsx'])

type OwnerEnvironment = NodeJS.ProcessEnv

export async function loadOwnerDatabaseUrl(
  directory = backendDir,
  inheritedEnvironment: OwnerEnvironment = process.env,
) {
  const injectedUrl = inheritedEnvironment.DIRECT_URL?.trim()
  if (injectedUrl) return injectedUrl

  const ownerEnvPath = resolve(directory, '.env.local')
  let ownerEnvSource: string
  try {
    ownerEnvSource = await readFile(ownerEnvPath, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    throw new Error(
      'Owner database URL is missing. Copy .env.local.example to .env.local and set DIRECT_URL.',
    )
  }

  const ownerDatabaseUrl = parse(ownerEnvSource).DIRECT_URL?.trim()
  if (!ownerDatabaseUrl) {
    throw new Error(
      'Owner database URL is missing. Set DIRECT_URL in backend/.env.local.',
    )
  }
  return ownerDatabaseUrl
}

export function buildOwnerJobEnvironment(
  inheritedEnvironment: OwnerEnvironment,
  ownerDatabaseUrl: string,
): OwnerEnvironment {
  return {
    ...inheritedEnvironment,
    DATABASE_URL: ownerDatabaseUrl,
    DIRECT_URL: ownerDatabaseUrl,
  }
}

function resolveToolEntrypoint(tool: string) {
  if (!supportedTools.has(tool)) {
    throw new Error(`Unsupported owner job tool: ${tool || '(missing)'}.`)
  }
  const packageName = tool === 'prisma' ? 'prisma' : 'tsx'
  const packagePath = require.resolve(`${packageName}/package.json`)
  const packageJson = require(packagePath) as {
    bin: string | Record<string, string>
  }
  const relativeEntrypoint =
    typeof packageJson.bin === 'string' ? packageJson.bin : packageJson.bin[tool]
  if (!relativeEntrypoint) throw new Error(`Unable to resolve the ${tool} executable.`)
  return resolve(dirname(packagePath), relativeEntrypoint)
}

export async function runOwnerJob(args = process.argv.slice(2)) {
  const [tool, ...toolArgs] = args
  const ownerDatabaseUrl = await loadOwnerDatabaseUrl()
  const childEnvironment = buildOwnerJobEnvironment(process.env, ownerDatabaseUrl)
  const entrypoint = resolveToolEntrypoint(tool ?? '')

  return await new Promise<number>((resolveExit, reject) => {
    const child = spawn(process.execPath, [entrypoint, ...toolArgs], {
      cwd: backendDir,
      env: childEnvironment,
      stdio: 'inherit',
    })
    child.once('error', reject)
    child.once('exit', (code, signal) => {
      if (signal) {
        reject(new Error(`Owner job terminated by signal ${signal}.`))
        return
      }
      resolveExit(code ?? 1)
    })
  })
}

if (resolve(process.argv[1] ?? '') === scriptPath) {
  try {
    process.exitCode = await runOwnerJob()
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
