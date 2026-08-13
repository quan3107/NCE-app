/**
 * File: tests/modules/auth/auth.family.database.test.ts
 * Purpose: Exercise refresh-family serialization against PostgreSQL MVCC.
 * Why: Mocked Prisma calls cannot prove logout sees a replacement inserted mid-flight.
 */
import { createHash, randomUUID } from "node:crypto";

import { PrismaPg } from "@prisma/adapter-pg";
import { describe, expect, it } from "vitest";

import {
  handleLogout,
  handleSessionRefresh,
} from "../../../src/modules/auth/auth.service.js";
import { PrismaClient } from "../../../src/prisma/generated.js";
import { createDatabaseTestOwnerPool } from "../../prisma/databaseTestClient.js";

const databaseDescribe =
  process.env.CI === "true" || process.env.RUN_DATABASE_TESTS === "true"
    ? describe.sequential
    : describe.skip;
const BARRIER_LOCK_ID = 2_026_081_301;
const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");

async function waitForAuthWaiters(
  owner: PrismaClient,
  queryPattern: string,
): Promise<void> {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const rows = await owner.$queryRaw<Array<{ waiting: bigint }>>`
      SELECT count(*)::bigint AS waiting
      FROM pg_stat_activity
      WHERE wait_event = 'advisory'
        AND query ILIKE ${queryPattern}
    `;
    if (Number(rows[0]?.waiting ?? 0) >= 1) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error("Refresh and logout did not overlap at the family barrier.");
}

databaseDescribe("auth session-family serialization", () => {
  it("commits family revocation before returning a refresh-reuse error", async () => {
    const pool = createDatabaseTestOwnerPool();
    const owner = new PrismaClient({ adapter: new PrismaPg(pool) });
    const userId = randomUUID();
    const sessionId = randomUUID();
    const refreshToken = `reused-${randomUUID()}`;
    try {
      await owner.user.create({
        data: {
          id: userId,
          email: `auth-reuse-${userId}@example.test`,
          fullName: "Auth Reuse Test",
          role: "student",
          status: "active",
        },
      });
      await owner.authSession.create({
        data: {
          id: sessionId,
          userId,
          familyId: sessionId,
          refreshTokenHash: hashToken(refreshToken),
          expiresAt: new Date(Date.now() + 60_000),
          replacedAt: new Date(),
        },
      });

      await expect(
        handleSessionRefresh({}, { refreshToken }),
      ).rejects.toMatchObject({ statusCode: 401 });
      await expect(
        owner.authSession.findUnique({
          where: { id: sessionId },
          select: { revokedAt: true, reuseDetectedAt: true },
        }),
      ).resolves.toMatchObject({
        revokedAt: expect.any(Date),
        reuseDetectedAt: expect.any(Date),
      });
    } finally {
      await owner.auditLog.deleteMany({ where: { actorId: userId } });
      await owner.authSession.deleteMany({ where: { familyId: sessionId } });
      await owner.user.deleteMany({ where: { id: userId } });
      await owner.$disconnect();
      await pool.end();
    }
  });

  it("revokes a replacement inserted after logout reads the original session", async () => {
    const pool = createDatabaseTestOwnerPool();
    const owner = new PrismaClient({ adapter: new PrismaPg(pool) });
    const observer = await pool.connect();
    const userId = randomUUID();
    const sessionId = randomUUID();
    const familyId = sessionId;
    const refreshToken = `refresh-${randomUUID()}`;
    const triggerName = `nce_test_auth_refresh_${process.pid}`;
    const functionName = triggerName;
    let barrierHeld = false;
    let refresh: ReturnType<typeof handleSessionRefresh> | undefined;
    let logout: ReturnType<typeof handleLogout> | undefined;

    try {
      await owner.user.create({
        data: {
          id: userId,
          email: `auth-family-${userId}@example.test`,
          fullName: "Auth Family Test",
          role: "student",
          status: "active",
        },
      });
      await owner.authSession.create({
        data: {
          id: sessionId,
          userId,
          familyId,
          refreshTokenHash: hashToken(refreshToken),
          expiresAt: new Date(Date.now() + 60_000),
        },
      });
      await observer.query("SELECT pg_advisory_lock($1::bigint)", [
        BARRIER_LOCK_ID,
      ]);
      barrierHeld = true;
      await observer.query(`
        CREATE OR REPLACE FUNCTION public.${functionName}()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $$
        BEGIN
          PERFORM pg_advisory_xact_lock(${BARRIER_LOCK_ID}::bigint);
          RETURN NEW;
        END;
        $$
      `);
      await observer.query(`
        CREATE TRIGGER ${triggerName}
        BEFORE UPDATE OF replaced_at ON public.auth_sessions
        FOR EACH ROW
        WHEN (OLD.family_id = '${familyId}'::uuid)
        EXECUTE FUNCTION public.${functionName}()
      `);

      refresh = handleSessionRefresh({}, { refreshToken });
      await waitForAuthWaiters(owner, "%UPDATE%auth_sessions%");
      logout = handleLogout({}, { refreshToken });
      await waitForAuthWaiters(owner, "%pg_advisory_xact_lock%");
      await observer.query("SELECT pg_advisory_unlock($1::bigint)", [
        BARRIER_LOCK_ID,
      ]);
      barrierHeld = false;
      await refresh;
      await logout;

      const family = await owner.authSession.findMany({
        where: { familyId },
        orderBy: { createdAt: "asc" },
        select: { replacedAt: true, revokedAt: true },
      });
      expect(family).toHaveLength(2);
      expect(family.every((session) => session.revokedAt !== null)).toBe(true);
      expect(family[0]?.replacedAt).not.toBeNull();
    } finally {
      if (barrierHeld) {
        await observer.query("SELECT pg_advisory_unlock($1::bigint)", [
          BARRIER_LOCK_ID,
        ]);
      }
      await Promise.allSettled([refresh, logout].filter(Boolean));
      await observer.query(
        `DROP TRIGGER IF EXISTS ${triggerName} ON public.auth_sessions`,
      );
      await observer.query(`DROP FUNCTION IF EXISTS public.${functionName}()`);
      await owner.auditLog.deleteMany({ where: { actorId: userId } });
      await owner.authSession.deleteMany({ where: { familyId } });
      await owner.user.deleteMany({ where: { id: userId } });
      observer.release();
      await owner.$disconnect();
      await pool.end();
    }
  }, 20_000);
});
