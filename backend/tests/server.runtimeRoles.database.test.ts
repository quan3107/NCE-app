/**
 * File: tests/server.runtimeRoles.database.test.ts
 * Purpose: Boot the compiled production server with the deployed role layout.
 * Why: Startup readiness and pg-boss must both work before HTTP traffic opens.
 */
import { spawn, type ChildProcess } from 'node:child_process'
import { generateKeyPairSync, randomUUID } from 'node:crypto'
import { createServer } from 'node:net'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

import { PrismaPg } from '@prisma/adapter-pg'
import PgBoss from 'pg-boss'
import { Pool } from 'pg'
import { describe, expect, it } from 'vitest'

import { PrismaClient } from '../src/prisma/generated.js'

const databaseDescribe =
  process.env.CI === 'true' || process.env.RUN_DATABASE_TESTS === 'true'
    ? describe
    : describe.skip
const DUE_SOON_JOB_NAME = 'notifications.due-soon'

function createOwnerDatabase() {
  const directUrl = process.env.DIRECT_URL
  if (!directUrl) {
    throw new Error('DIRECT_URL is required for the runtime-role database test.')
  }

  const pool = new Pool({ connectionString: directUrl })
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

  return {
    prisma,
    close: async () => {
      await prisma.$disconnect()
      await pool.end()
    },
  }
}

async function reservePort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const listener = createServer()
    listener.once('error', reject)
    listener.listen(0, '127.0.0.1', () => {
      const address = listener.address()
      if (!address || typeof address === 'string') {
        listener.close()
        reject(new Error('Unable to reserve a test server port.'))
        return
      }
      listener.close((error) => {
        if (error) {
          reject(error)
          return
        }
        resolvePort(address.port)
      })
    })
  })
}

async function stopChild(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null) {
    return
  }
  child.kill('SIGTERM')
  await Promise.race([
    new Promise<void>((resolveExit) => child.once('exit', () => resolveExit())),
    delay(5_000).then(() => undefined),
  ])
  if (child.exitCode === null) {
    child.kill('SIGKILL')
  }
}

databaseDescribe('production server runtime roles', () => {
  it('starts readiness and processes a real pg-boss job', async () => {
    const serverEntry = resolve(process.cwd(), 'dist/server.js')
    expect(existsSync(serverEntry)).toBe(true)
    expect(process.env.DATABASE_URL).toContain('nce_runtime')
    expect(process.env.JOB_DATABASE_URL).toContain('nce_job_runner')

    const jobDatabaseUrl = process.env.JOB_DATABASE_URL
    if (!jobDatabaseUrl) {
      throw new Error('JOB_DATABASE_URL is required for the runtime-role database test.')
    }

    const ownerDatabase = createOwnerDatabase()
    const ownerPrisma = ownerDatabase.prisma
    const fixture = {
      teacherId: randomUUID(),
      studentId: randomUUID(),
      courseId: randomUUID(),
      enrollmentId: randomUUID(),
      assignmentId: randomUUID(),
    }
    const uniqueSuffix = fixture.assignmentId.slice(0, 8)
    await ownerPrisma.$transaction(async (tx) => {
      await tx.user.createMany({
        data: [
          {
            id: fixture.teacherId,
            email: `runtime-job-teacher-${uniqueSuffix}@example.test`,
            fullName: 'Runtime Job Teacher',
            role: 'teacher',
            status: 'active',
          },
          {
            id: fixture.studentId,
            email: `runtime-job-student-${uniqueSuffix}@example.test`,
            fullName: 'Runtime Job Student',
            role: 'student',
            status: 'active',
          },
        ],
      })
      await tx.course.create({
        data: {
          id: fixture.courseId,
          title: 'Runtime Role Job Course',
          ownerId: fixture.teacherId,
        },
      })
      await tx.enrollment.create({
        data: {
          id: fixture.enrollmentId,
          courseId: fixture.courseId,
          userId: fixture.studentId,
          roleInCourse: 'student',
        },
      })
      await tx.assignment.create({
        data: {
          id: fixture.assignmentId,
          courseId: fixture.courseId,
          title: 'Runtime Role Due Soon Assignment',
          type: 'text',
          dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          publishedAt: new Date(),
        },
      })
    })

    const port = await reservePort()
    // Production never generates fallback JWT keys, so give the child valid
    // in-memory key material without creating test secrets on disk.
    const jwtKeys = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      publicKeyEncoding: { type: 'spki', format: 'pem' },
    })
    const childEnv = {
      ...process.env,
      CORS_ALLOWED_ORIGINS: 'https://app.example.test',
      JWT_PRIVATE_KEY: jwtKeys.privateKey,
      JWT_PUBLIC_KEY: jwtKeys.publicKey,
      LOG_LEVEL: 'silent',
      LOG_PRETTY: 'false',
      NCE_ASSET_ROOT: 'tests/fixtures/nce-assets',
      NODE_ENV: 'production',
      PORT: String(port),
    }
    delete childEnv.DIRECT_URL

    const child = spawn(process.execPath, [serverEntry], {
      cwd: process.cwd(),
      env: childEnv,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let output = ''
    child.stdout?.on('data', (chunk) => {
      output += String(chunk)
    })
    child.stderr?.on('data', (chunk) => {
      output += String(chunk)
    })
    let boss: PgBoss | null = null

    try {
      const deadline = Date.now() + 20_000
      let healthResponse: Response | null = null

      while (Date.now() < deadline && child.exitCode === null) {
        try {
          healthResponse = await fetch(`http://127.0.0.1:${port}/health`)
          if (healthResponse.ok) {
            break
          }
        } catch {
          // The socket is expected to refuse connections until bootstrap finishes.
        }
        await delay(100)
      }

      expect(child.exitCode, output).toBeNull()
      expect(healthResponse?.status, output).toBe(200)
      await expect(healthResponse?.json()).resolves.toMatchObject({ ok: true })

      boss = new PgBoss({
        connectionString: jobDatabaseUrl,
        application_name: 'nce-app-runtime-role-test',
        migrate: false,
      })
      boss.on('error', () => undefined)
      await boss.start()
      const jobId = await boss.send(DUE_SOON_JOB_NAME, {})
      expect(jobId).toBeTruthy()

      const jobDeadline = Date.now() + 15_000
      let notificationCount = 0
      while (Date.now() < jobDeadline) {
        notificationCount = await ownerPrisma.notification.count({
          where: {
            userId: fixture.studentId,
            type: 'due_soon',
          },
        })
        if (notificationCount === 2) {
          break
        }
        await delay(100)
      }
      expect(notificationCount, output).toBe(2)
    } finally {
      if (boss) {
        await boss.stop()
      }
      await stopChild(child)
      await ownerPrisma.$transaction(async (tx) => {
        await tx.notification.deleteMany({ where: { userId: fixture.studentId } })
        await tx.assignment.deleteMany({ where: { id: fixture.assignmentId } })
        await tx.enrollment.deleteMany({ where: { id: fixture.enrollmentId } })
        await tx.course.deleteMany({ where: { id: fixture.courseId } })
        await tx.user.deleteMany({
          where: { id: { in: [fixture.teacherId, fixture.studentId] } },
        })
      })
      await ownerDatabase.close()
    }
  }, 45_000)
})
