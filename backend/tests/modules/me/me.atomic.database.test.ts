/**
 * File: tests/modules/me/me.atomic.database.test.ts
 * Purpose: Verify profile-update concurrency against real PostgreSQL.
 * Why: Mocked counts cannot prove row-lock rechecks or delete/update interleavings.
 */
import { randomUUID } from "node:crypto";

import { PrismaPg } from "@prisma/adapter-pg";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { app } from "../../../src/app.js";
import { updateMeProfileSchema } from "../../../src/modules/me/me.schema.js";
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
    () => updateMeProfile(userId, { fullName, expectedRevision: 0 }),
  );

databaseDescribe("atomic profile updates", () => {
  it("returns terminal profile states for every authenticated role", async () => {
    const pool = createDatabaseTestOwnerPool();
    const owner = new PrismaClient({ adapter: new PrismaPg(pool) });
    const userIds: string[] = [];

    try {
      for (const role of ["admin", "teacher", "student"] as const) {
        for (const terminalState of ["suspended", "deleted"] as const) {
          const userId = randomUUID();
          userIds.push(userId);
          await owner.user.create({
            data: {
              id: userId,
              email: `profile-${role}-${terminalState}-${userId}@example.test`,
              fullName: `${role} ${terminalState}`,
              role,
              status: terminalState === "suspended" ? "suspended" : "active",
              deletedAt: terminalState === "deleted" ? new Date() : null,
            },
          });

          const response = await request(app).get("/api/v1/me").set({
            "x-user-id": userId,
            "x-user-role": role,
            "x-user-status": "active",
          });
          expect(response.status).toBe(
            terminalState === "suspended" ? 403 : 404,
          );
        }
      }
    } finally {
      await owner.auditLog.deleteMany({ where: { actorId: { in: userIds } } });
      await owner.user.deleteMany({ where: { id: { in: userIds } } });
      await owner.$disconnect();
      await pool.end();
    }
  });

  it("persists PostgreSQL-safe astral names exactly", async () => {
    const pool = createDatabaseTestOwnerPool();
    const owner = new PrismaClient({ adapter: new PrismaPg(pool) });
    const userId = randomUUID();
    const fullName = "Ada 😀 Lovelace";
    try {
      await owner.user.create({
        data: {
          id: userId,
          email: `profile-unicode-${userId}@example.test`,
          fullName: "Original Name",
          role: "student",
          status: "active",
        },
      });
      const parsed = updateMeProfileSchema.parse({
        fullName,
        expectedRevision: 0,
      });

      await updateAsStudent(userId, parsed.fullName);

      await expect(
        owner.user.findUnique({
          where: { id: userId },
          select: { fullName: true },
        }),
      ).resolves.toEqual({ fullName });
    } finally {
      await owner.auditLog.deleteMany({ where: { actorId: userId } });
      await owner.user.deleteMany({ where: { id: userId } });
      await owner.$disconnect();
      await pool.end();
    }
  });

  it("rejects PostgreSQL-unsafe route input without changing the row", async () => {
    const pool = createDatabaseTestOwnerPool();
    const owner = new PrismaClient({ adapter: new PrismaPg(pool) });
    const userId = randomUUID();
    try {
      await owner.user.create({
        data: {
          id: userId,
          email: `profile-unsafe-${userId}@example.test`,
          fullName: "Original Name",
          role: "student",
          status: "active",
        },
      });

      for (const fullName of [
        "Ada\u0000Lovelace",
        "Ada\uD800Lovelace",
        "Ada\uDC00Lovelace",
        "Ada\u200BLovelace",
        "Ada\u202ELovelace",
        "Ada\tLovelace",
        "Ada\nLovelace",
      ]) {
        const response = await request(app)
          .patch("/api/v1/me")
          .set({
            "x-user-id": userId,
            "x-user-role": "student",
            "x-user-status": "active",
          })
          .send({ fullName, expectedRevision: 0 });
        expect(response.status).toBe(400);
      }

      await expect(
        owner.user.findUnique({
          where: { id: userId },
          select: { fullName: true },
        }),
      ).resolves.toEqual({ fullName: "Original Name" });
      await expect(
        owner.auditLog.count({
          where: { actorId: userId, action: "user.profile_updated" },
        }),
      ).resolves.toBe(0);
    } finally {
      await owner.auditLog.deleteMany({ where: { actorId: userId } });
      await owner.user.deleteMany({ where: { id: userId } });
      await owner.$disconnect();
      await pool.end();
    }
  });

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

  it("keeps the database winner when a stale profile revision writes later", async () => {
    const pool = createDatabaseTestOwnerPool();
    const owner = new PrismaClient({ adapter: new PrismaPg(pool) });
    const userId = randomUUID();
    try {
      await owner.user.create({
        data: {
          id: userId,
          email: `profile-stale-${userId}@example.test`,
          fullName: "Original Name",
          role: "student",
          status: "active",
        },
      });

      await updateAsStudent(userId, "Winning Name");
      await expect(
        runWithRole(
          {
            role: "nce_app_authenticated",
            userId,
            userRole: "student",
          },
          () =>
            updateMeProfile(userId, {
              fullName: "Stale Name",
              expectedRevision: 0,
            }),
        ),
      ).rejects.toMatchObject({ statusCode: 409 });

      await expect(
        owner.user.findUnique({
          where: { id: userId },
          select: { fullName: true, profileRevision: true },
        }),
      ).resolves.toEqual({ fullName: "Winning Name", profileRevision: 1 });
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
