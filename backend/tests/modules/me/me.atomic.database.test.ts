/**
 * File: tests/modules/me/me.atomic.database.test.ts
 * Purpose: Verify profile-update concurrency against real PostgreSQL.
 * Why: Mocked counts cannot prove row-lock rechecks or delete/update interleavings.
 */
import { randomUUID } from "node:crypto";

import { PrismaPg } from "@prisma/adapter-pg";
import { describe, expect, it } from "vitest";

import { updateMeProfile } from "../../../src/modules/me/me.service.js";
import { runWithRole } from "../../../src/prisma/client.js";
import { PrismaClient } from "../../../src/prisma/generated.js";
import { createDatabaseTestOwnerPool } from "../../prisma/databaseTestClient.js";

const databaseDescribe =
  process.env.CI === "true" || process.env.RUN_DATABASE_TESTS === "true"
    ? describe
    : describe.skip;

const updateAsStudent = (userId: string, fullName: string) =>
  runWithRole(
    {
      role: "nce_app_authenticated",
      userId,
      userRole: "student",
    },
    () => updateMeProfile(userId, { fullName }),
  );

databaseDescribe("atomic profile updates", () => {
  it("creates one audit event for concurrent identical requests", async () => {
    const pool = createDatabaseTestOwnerPool();
    const owner = new PrismaClient({ adapter: new PrismaPg(pool) });
    const userId = randomUUID();
    try {
      await owner.user.create({
        data: {
          id: userId,
          email: `profile-concurrency-${userId}@example.test`,
          fullName: "Original Name",
          role: "student",
          status: "active",
        },
      });

      await Promise.all([
        updateAsStudent(userId, "Concurrent Name"),
        updateAsStudent(userId, "Concurrent Name"),
      ]);

      await expect(
        owner.auditLog.count({
          where: { actorId: userId, action: "user.profile_updated" },
        }),
      ).resolves.toBe(1);
      await expect(
        owner.user.findUnique({
          where: { id: userId },
          select: { fullName: true },
        }),
      ).resolves.toEqual({ fullName: "Concurrent Name" });
    } finally {
      await owner.auditLog.deleteMany({ where: { actorId: userId } });
      await owner.user.deleteMany({ where: { id: userId } });
      await owner.$disconnect();
      await pool.end();
    }
  });

  it("does not update a row that is concurrently soft-deleted", async () => {
    const pool = createDatabaseTestOwnerPool();
    const owner = new PrismaClient({ adapter: new PrismaPg(pool) });
    const userId = randomUUID();
    let releaseDelete = () => undefined;
    let markDeleted = () => undefined;
    const deleteMayCommit = new Promise<void>((resolve) => {
      releaseDelete = resolve;
    });
    const deleteStarted = new Promise<void>((resolve) => {
      markDeleted = resolve;
    });

    try {
      await owner.user.create({
        data: {
          id: userId,
          email: `profile-delete-${userId}@example.test`,
          fullName: "Original Name",
          role: "student",
          status: "active",
        },
      });

      const deleteRequest = owner.$transaction(async (transaction) => {
        await transaction.user.update({
          where: { id: userId },
          data: { deletedAt: new Date() },
        });
        markDeleted();
        await deleteMayCommit;
      });
      await deleteStarted;

      const updateRequest = updateAsStudent(userId, "Too Late");
      await new Promise<void>((resolve) => setImmediate(resolve));
      releaseDelete();
      await deleteRequest;

      await expect(updateRequest).rejects.toMatchObject({ statusCode: 404 });
      await expect(
        owner.user.findUnique({
          where: { id: userId },
          select: { fullName: true, deletedAt: true },
        }),
      ).resolves.toMatchObject({
        fullName: "Original Name",
        deletedAt: expect.any(Date),
      });
      await expect(
        owner.auditLog.count({
          where: { actorId: userId, action: "user.profile_updated" },
        }),
      ).resolves.toBe(0);
    } finally {
      releaseDelete();
      await owner.auditLog.deleteMany({ where: { actorId: userId } });
      await owner.user.deleteMany({ where: { id: userId } });
      await owner.$disconnect();
      await pool.end();
    }
  });
});
