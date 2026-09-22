/**
 * File: tests/modules/auth/auth.google.link.database.test.ts
 * Purpose: Exercise link authorization and atomicity against real PostgreSQL/API.
 * Why: Synthetic verified profiles isolate persistence; they are NOT live OAuth acceptance.
 */
import { randomUUID } from 'node:crypto'
import bcrypt from 'bcrypt'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { app } from '../../../src/app.js'
import { prisma } from '../../../src/config/prismaClient.js'
import { runWithRole } from '../../../src/prisma/client.js'
import { findOrCreateGoogleIdentity } from '../../../src/modules/auth/auth.google.identity.js'
import {
  confirmGoogleLink,
  cancelGoogleLink,
  readGoogleLinkChallenge,
} from '../../../src/modules/auth/auth.google.link.js'
import { handlePasswordLogin } from '../../../src/modules/auth/auth.password.js'
import { resetAuthRateLimiter } from '../../../src/modules/auth/auth.rate-limit.js'
import { createDatabaseTestOwnerPool } from '../../prisma/databaseTestClient.js'

const suite =
  process.env.RUN_DATABASE_TESTS === 'true' || process.env.CI === 'true'
    ? describe.sequential
    : describe.skip
const role = { role: 'service_role', userRole: 'service_role' } as const
const password = 'Link-verification-2026!'
suite(
  'Google linking database boundary (synthetic verified profiles, not OAuth acceptance)',
  () => {
    let owner: ReturnType<typeof createDatabaseTestOwnerPool>
    const users: string[] = []
    beforeAll(() => {
      owner = createDatabaseTestOwnerPool()
    })
    beforeEach(resetAuthRateLimiter)
    afterAll(async () => {
      for (const table of ['audit_logs', 'auth_sessions', 'identities']) {
        await owner.query(
          `DELETE FROM ${table} WHERE ${table === 'audit_logs' ? 'actor_user_id' : 'user_id'} = ANY($1::uuid[])`,
          [users],
        )
      }
      await owner.query('DELETE FROM users WHERE id=ANY($1::uuid[])', [users])
      await owner.end()
    })
    async function fixture() {
      const id = randomUUID()
      users.push(id)
      const email = `link-${id}@example.invalid`
      const hash = await bcrypt.hash(password, 4)
      await owner.query(
        `INSERT INTO users(id,email,password_hash,full_name,role,status,"updatedAt") VALUES($1,$2,$3,'Preserved Name','student','active',now())`,
        [id, email, hash],
      )
      const profile = {
        providerSubject: randomUUID(),
        providerIssuer: 'https://accounts.google.com',
        normalizedEmail: email,
        emailVerified: true,
        fullName: 'Google Name',
      }
      const result = await runWithRole(role, () => findOrCreateGoogleIdentity(profile))
      if (!('status' in result)) throw new Error('Expected challenge')
      const challenge = await readGoogleLinkChallenge(result.token)
      return {
        id,
        email,
        hash,
        profile,
        token: result.token,
        body: { challengeId: challenge.challengeId, consent: true as const, password },
      }
    }
    async function identityCount(id: string) {
      return Number(
        (await owner.query('SELECT count(*) FROM identities WHERE user_id=$1', [id]))
          .rows[0].count,
      )
    }
    it('requires consent and browser proof; keeps the original account and password', async () => {
      const f = await fixture()
      expect(await identityCount(f.id)).toBe(0)
      await request(app).post('/api/v1/auth/google/link').send(f.body).expect(400)
      await expect(
        confirmGoogleLink(f.token, { ...f.body, consent: false }, {}),
      ).rejects.toThrow()
      await expect(confirmGoogleLink('0'.repeat(64), f.body, {})).rejects.toMatchObject({
        statusCode: 400,
      })
      await confirmGoogleLink(f.token, f.body, {})
      expect(await identityCount(f.id)).toBe(1)
      const { rows } = await owner.query(
        'SELECT id,full_name,password_hash FROM users WHERE email=$1',
        [f.email],
      )
      expect(rows).toEqual([
        { id: f.id, full_name: 'Preserved Name', password_hash: f.hash },
      ])
      expect((await handlePasswordLogin({ email: f.email, password }, {})).user.id).toBe(
        f.id,
      )
      const linked = await runWithRole(role, () => findOrCreateGoogleIdentity(f.profile))
      expect('user' in linked && linked.user.id).toBe(f.id)
      await expect(confirmGoogleLink(f.token, f.body, {})).rejects.toMatchObject({
        statusCode: 400,
      })
    })
    it('cancels durably and rejects replay', async () => {
      const f = await fixture()
      await request(app)
        .post('/api/v1/auth/google/link/cancel')
        .set('Cookie', `googleLinkToken=${f.token}`)
        .send({ challengeId: f.body.challengeId })
        .expect(204)
      await expect(confirmGoogleLink(f.token, f.body, {})).rejects.toMatchObject({
        statusCode: 400,
      })
      expect(await identityCount(f.id)).toBe(0)
    })
    it('allows password retry and shares brute-force limits with password login', async () => {
      const f = await fixture()
      await expect(
        confirmGoogleLink(f.token, { ...f.body, password: 'wrong' }, {}),
      ).rejects.toMatchObject({ statusCode: 401 })
      expect(await identityCount(f.id)).toBe(0)
      await confirmGoogleLink(f.token, f.body, {})
      resetAuthRateLimiter()
      const g = await fixture()
      for (let index = 0; index < 3; index++) {
        await expect(
          confirmGoogleLink(g.token, { ...g.body, password: 'wrong' }, {}),
        ).rejects.toMatchObject({ statusCode: 401 })
      }
      await expect(confirmGoogleLink(g.token, g.body, {})).rejects.toMatchObject({
        statusCode: 429,
      })
      await expect(
        handlePasswordLogin({ email: g.email, password }, {}),
      ).rejects.toMatchObject({ statusCode: 429 })
      expect(await identityCount(g.id)).toBe(0)
    })
    it.each([
      'expired',
      'pending',
      'suspended',
      'deleted',
      'password_changed',
      'email_changed',
    ])('rejects %s state at confirmation', async (state) => {
      const f = await fixture()
      if (state === 'expired')
        await owner.query(
          "UPDATE google_link_challenges SET expires_at=now()-interval '1 second' WHERE user_id=$1",
          [f.id],
        )
      if (state === 'pending' || state === 'suspended')
        await owner.query('UPDATE users SET status=$2::"UserStatus" WHERE id=$1', [
          f.id,
          state,
        ])
      if (state === 'deleted')
        await owner.query('UPDATE users SET "deletedAt"=now() WHERE id=$1', [f.id])
      if (state === 'password_changed')
        await owner.query('UPDATE users SET password_hash=$2 WHERE id=$1', [
          f.id,
          await bcrypt.hash(password, 4),
        ])
      if (state === 'email_changed')
        await owner.query('UPDATE users SET email=$2 WHERE id=$1', [
          f.id,
          `changed-${f.email}`,
        ])
      await expect(confirmGoogleLink(f.token, f.body, {})).rejects.toThrow()
      expect(await identityCount(f.id)).toBe(0)
    })
    it('consumes exactly once under concurrent confirmation', async () => {
      const f = await fixture()
      const results = await Promise.allSettled([
        confirmGoogleLink(f.token, f.body, {}),
        confirmGoogleLink(f.token, f.body, {}),
      ])
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
      expect(await identityCount(f.id)).toBe(1)
    })
    it('invalidates an older attempt and rejects issuer/subject conflicts without reassigning', async () => {
      const f = await fixture()
      const newer = await runWithRole(role, () => findOrCreateGoogleIdentity(f.profile))
      expect('status' in newer).toBe(true)
      await expect(confirmGoogleLink(f.token, f.body, {})).rejects.toMatchObject({
        statusCode: 400,
      })
      const g = await fixture()
      await runWithRole(role, () =>
        prisma.identity.create({
          data: {
            userId: g.id,
            provider: 'google',
            providerSubject: g.profile.providerSubject,
            providerIssuer: 'untrusted-issuer',
            email: g.email,
            emailVerified: true,
          },
        }),
      )
      await expect(confirmGoogleLink(g.token, g.body, {})).rejects.toMatchObject({
        statusCode: 409,
      })
      await expect(
        runWithRole(role, () => findOrCreateGoogleIdentity(g.profile)),
      ).rejects.toMatchObject({ statusCode: 409 })
    })
    it('reports exactly one winner when cancellation races confirmation', async () => {
      const f = await fixture()
      const results = await Promise.allSettled([
        cancelGoogleLink(f.token, { challengeId: f.body.challengeId }),
        confirmGoogleLink(f.token, f.body, {}),
      ])
      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
      expect(await identityCount(f.id)).toBe(results[1].status === 'fulfilled' ? 1 : 0)
    })
    it('keeps challenge data inaccessible to Data API and request roles', async () => {
      const { rows } = await owner.query(
        `SELECT rolname, has_table_privilege(rolname,'public.google_link_challenges','SELECT,INSERT,UPDATE,DELETE') AS allowed FROM pg_roles WHERE rolname=ANY($1)`,
        [['anon', 'authenticated', 'nce_app_anon', 'nce_app_authenticated']],
      )
      expect(rows).toHaveLength(4)
      expect(rows.every((r: { allowed: boolean }) => !r.allowed)).toBe(true)
    })
    it('rejects unverified profiles and inactive matching accounts before issuing proof', async () => {
      const f = await fixture()
      await expect(
        runWithRole(role, () =>
          findOrCreateGoogleIdentity({ ...f.profile, emailVerified: false }),
        ),
      ).rejects.toMatchObject({ statusCode: 401 })
      for (const status of ['pending', 'suspended']) {
        await owner.query('UPDATE users SET status=$2::"UserStatus" WHERE id=$1', [
          f.id,
          status,
        ])
        await expect(
          runWithRole(role, () => findOrCreateGoogleIdentity(f.profile)),
        ).rejects.toMatchObject({ statusCode: 403 })
      }
      await owner.query('UPDATE users SET "deletedAt"=now() WHERE id=$1', [f.id])
      await expect(
        runWithRole(role, () => findOrCreateGoogleIdentity(f.profile)),
      ).rejects.toMatchObject({ statusCode: 403 })
      expect(await identityCount(f.id)).toBe(0)
    })
    it('never reassigns a subject that was linked to another account while consent was pending', async () => {
      const f = await fixture()
      const g = await fixture()
      await runWithRole(role, () =>
        prisma.identity.create({
          data: {
            userId: g.id,
            provider: 'google',
            providerSubject: f.profile.providerSubject,
            providerIssuer: f.profile.providerIssuer,
            email: g.email,
            emailVerified: true,
          },
        }),
      )
      await expect(confirmGoogleLink(f.token, f.body, {})).rejects.toMatchObject({
        statusCode: 409,
      })
      expect(await identityCount(f.id)).toBe(0)
      expect(await identityCount(g.id)).toBe(1)
    })
    it('rolls back identity creation if challenge consumption fails', async () => {
      const f = await fixture()
      const trigger = `link_failure_${process.pid}`
      try {
        await owner.query(
          `CREATE FUNCTION ${trigger}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF OLD.user_id='${f.id}'::uuid THEN RAISE EXCEPTION 'link rollback test'; END IF; RETURN OLD; END $$`,
        )
        await owner.query(
          `CREATE TRIGGER ${trigger} BEFORE DELETE ON google_link_challenges FOR EACH ROW EXECUTE FUNCTION ${trigger}()`,
        )
        await expect(confirmGoogleLink(f.token, f.body, {})).rejects.toThrow()
        expect(await identityCount(f.id)).toBe(0)
        expect((await readGoogleLinkChallenge(f.token)).challengeId).toBe(
          f.body.challengeId,
        )
      } finally {
        await owner.query(`DROP TRIGGER IF EXISTS ${trigger} ON google_link_challenges`)
        await owner.query(`DROP FUNCTION IF EXISTS ${trigger}()`)
      }
      await confirmGoogleLink(f.token, f.body, {})
    })
  },
)
