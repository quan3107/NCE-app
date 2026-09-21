/**
 * File: tests/modules/auth/auth.recovery.database.test.ts
 * Purpose: Verify password reset atomicity and session revocation on PostgreSQL.
 * Why: Real transactions and bearer authorization cannot be proven by Prisma mocks.
 */
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import bcrypt from 'bcrypt'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { app } from '../../../src/app.js'
import {
  requestPasswordReset,
  resetPassword,
} from '../../../src/modules/auth/auth.recovery.js'
import {
  handlePasswordLogin,
  handleSessionRefresh,
} from '../../../src/modules/auth/auth.service.js'
import { resetAuthRateLimiter } from '../../../src/modules/auth/auth.rate-limit.js'
import { createDatabaseTestOwnerPool } from '../../prisma/databaseTestClient.js'

const databaseDescribe =
  process.env.CI === 'true' || process.env.RUN_DATABASE_TESTS === 'true'
    ? describe.sequential
    : describe.skip
const oldPassword = 'Recovery-before-2026'
const newPassword = 'Recovery-after-2026'
const digest = (token: string) => createHash('sha256').update(token).digest('hex')

databaseDescribe('password recovery transactions', () => {
  const pool = createDatabaseTestOwnerPool
  let owner: ReturnType<typeof pool>
  const users: string[] = []
  beforeAll(() => {
    owner = pool()
  })
  afterAll(async () => {
    await owner.query('DELETE FROM audit_logs WHERE actor_user_id = ANY($1::uuid[])', [
      users,
    ])
    await owner.query('DELETE FROM auth_sessions WHERE user_id = ANY($1::uuid[])', [
      users,
    ])
    await owner.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [users])
    await owner.end()
  })

  async function fixture(
    options: { expired?: boolean; status?: string; noPassword?: boolean } = {},
  ) {
    const id = randomUUID()
    users.push(id)
    const token = randomBytes(32).toString('hex')
    const email = `recovery-${id}@example.invalid`
    await owner.query(
      `INSERT INTO users (id,email,password_hash,full_name,role,status,"updatedAt",password_reset_hash,password_reset_expires_at)
      VALUES ($1,$2,$3,'Recovery Test','student',$4,now(),$5,$6)`,
      [
        id,
        email,
        options.noPassword ? null : await bcrypt.hash(oldPassword, 4),
        options.status ?? 'active',
        digest(token),
        new Date(Date.now() + (options.expired ? -1000 : 1_800_000)),
      ],
    )
    return { id, token, email }
  }

  it('rejects all old access and refresh sessions and only accepts the new password', async () => {
    const account = await fixture()
    resetAuthRateLimiter()
    const first = await handlePasswordLogin(
      { email: account.email, password: oldPassword },
      {},
    )
    const second = await handlePasswordLogin(
      { email: account.email, password: oldPassword },
      {},
    )
    const protectedRequest = (accessToken: string) =>
      request(app).get('/api/v1/me').set('Authorization', `Bearer ${accessToken}`)
    expect((await protectedRequest(first.accessToken)).status).toBe(200)
    await resetPassword({ token: account.token, password: newPassword })
    for (const session of [first, second]) {
      expect((await protectedRequest(session.accessToken)).status).toBe(401)
      await expect(
        handleSessionRefresh({}, { refreshToken: session.refreshToken }),
      ).rejects.toMatchObject({ statusCode: 401 })
    }
    await expect(
      handlePasswordLogin({ email: account.email, password: oldPassword }, {}),
    ).rejects.toMatchObject({ statusCode: 401 })
    await expect(
      handlePasswordLogin({ email: account.email, password: newPassword }, {}),
    ).resolves.toHaveProperty('accessToken')
    await expect(
      resetPassword({ token: account.token, password: oldPassword }),
    ).rejects.toMatchObject({ statusCode: 400 })
    const { rows } = await owner.query(
      'SELECT password_reset_hash, password_reset_expires_at FROM users WHERE id=$1',
      [account.id],
    )
    expect(rows[0]).toEqual({
      password_reset_hash: null,
      password_reset_expires_at: null,
    })
  })

  it.each([
    { expired: true },
    { status: 'pending' },
    { status: 'suspended' },
    { noPassword: true },
  ])('rejects ineligible or expired credentials: %j', async (options) => {
    const account = await fixture(options)
    await expect(
      resetPassword({ token: account.token, password: newPassword }),
    ).rejects.toMatchObject({ statusCode: 400 })
  })

  it('allows exactly one concurrent consumption', async () => {
    const account = await fixture()
    const results = await Promise.allSettled([
      resetPassword({ token: account.token, password: newPassword }),
      resetPassword({ token: account.token, password: oldPassword }),
    ])
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1)
  })

  it('keeps a newly issued link during the recipient cooldown without sending another email', async () => {
    const account = await fixture()
    await requestPasswordReset({ email: account.email.toUpperCase() })
    const { rows } = await owner.query(
      'SELECT password_reset_hash FROM users WHERE id=$1',
      [account.id],
    )
    expect(rows[0].password_reset_hash).toBe(digest(account.token))
  })

  it('rejects a link after the account is soft-deleted', async () => {
    const account = await fixture()
    await owner.query('UPDATE users SET "deletedAt"=now() WHERE id=$1', [account.id])
    await expect(
      resetPassword({ token: account.token, password: newPassword }),
    ).rejects.toMatchObject({ statusCode: 400 })
  })

  it('rolls back password and token if session revocation fails', async () => {
    const account = await fixture()
    resetAuthRateLimiter()
    await handlePasswordLogin({ email: account.email, password: oldPassword }, {})
    const name = `recovery_failure_${process.pid}`
    try {
      await owner.query(`CREATE FUNCTION ${name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
        IF NEW.user_id = '${account.id}'::uuid THEN RAISE EXCEPTION 'recovery test rollback'; END IF;
        RETURN NEW; END $$`)
      await owner.query(
        `CREATE TRIGGER ${name} BEFORE UPDATE ON auth_sessions FOR EACH ROW EXECUTE FUNCTION ${name}()`,
      )
      await expect(
        resetPassword({ token: account.token, password: newPassword }),
      ).rejects.toThrow()
      const { rows } = await owner.query(
        'SELECT password_hash,password_reset_hash FROM users WHERE id=$1',
        [account.id],
      )
      expect(await bcrypt.compare(oldPassword, rows[0].password_hash)).toBe(true)
      expect(rows[0].password_reset_hash).toBe(digest(account.token))
    } finally {
      await owner.query(`DROP TRIGGER IF EXISTS ${name} ON auth_sessions`)
      await owner.query(`DROP FUNCTION IF EXISTS ${name}()`)
    }
  })

  it('enforces the existing password policy before consuming a link', async () => {
    const account = await fixture()
    await expect(
      resetPassword({ token: account.token, password: 'short' }),
    ).rejects.toThrow()
    await expect(
      resetPassword({ token: account.token, password: newPassword }),
    ).resolves.toBeUndefined()
  })

  it('rejects login and refresh that read old credentials while reset waits for the account lock', async () => {
    const account = await fixture()
    resetAuthRateLimiter()
    const session = await handlePasswordLogin(
      { email: account.email, password: oldPassword },
      {},
    )
    const blocker = await owner.connect()
    const { rows: blockerRows } = await blocker.query('SELECT pg_backend_pid() AS pid')
    const blockerPid = blockerRows[0].pid
    const pending: Promise<unknown>[] = []
    const waitForLocks = async (count: number) => {
      const deadline = Date.now() + 5000
      while (Date.now() < deadline) {
        // Owner credentials deliberately cannot read other roles' query text.
        // Follow the lock graph instead, including waiters queued behind reset.
        const { rows } = await owner.query(
          `WITH RECURSIVE waiting AS (
          SELECT pid FROM pg_stat_activity WHERE $1 = ANY(pg_blocking_pids(pid))
          UNION SELECT activity.pid FROM pg_stat_activity activity
          JOIN waiting ON waiting.pid = ANY(pg_blocking_pids(activity.pid))
        ) SELECT count(DISTINCT pid)::integer AS count FROM waiting`,
          [blockerPid],
        )
        if (rows[0].count >= count) return
        await new Promise((resolve) => setTimeout(resolve, 20))
      }
      throw new Error('Concurrent auth operations did not reach the account lock')
    }
    try {
      await blocker.query('BEGIN')
      await blocker.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [account.id])
      pending.push(resetPassword({ token: account.token, password: newPassword }))
      await waitForLocks(1)
      pending.push(
        handlePasswordLogin({ email: account.email, password: oldPassword }, {}),
      )
      pending.push(handleSessionRefresh({}, { refreshToken: session.refreshToken }))
      // Register rejection handlers before releasing the barrier.
      const results = Promise.allSettled(pending)
      await waitForLocks(3)
      await blocker.query('COMMIT')
      const [reset, login, refresh] = await results
      expect(reset.status).toBe('fulfilled')
      expect(login).toMatchObject({ status: 'rejected', reason: { statusCode: 401 } })
      expect(refresh).toMatchObject({ status: 'rejected', reason: { statusCode: 401 } })
      const { rows } = await owner.query(
        'SELECT count(*)::integer AS count FROM auth_sessions WHERE user_id=$1 AND revoked_at IS NULL',
        [account.id],
      )
      expect(rows[0].count).toBe(0)
    } finally {
      await blocker.query('ROLLBACK')
      blocker.release()
      await Promise.allSettled(pending)
    }
  }, 15000)
})
