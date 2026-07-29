/**
 * File: tests/modules/me/me.service.test.ts
 * Purpose: Verify authenticated profile updates persist and produce bounded audit data.
 * Why: Profile edits must survive reloads without copying personal names into audit logs.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/prisma/client.js", () => ({
  prisma: {
    $transaction: vi.fn(),
  },
}));

const prismaModule = await import("../../../src/prisma/client.js");
const prisma = vi.mocked(prismaModule.prisma, true);
const transactionUserUpdateMany = vi.fn();
const transactionUserFindFirst = vi.fn();
const transactionAuditCreate = vi.fn();
const { updateMeProfile } = await import(
  "../../../src/modules/me/me.service.js"
);

const userId = "7f6c9f72-1e95-4f36-8f06-0f0a9ed0b1c2";

describe("me.service profile updates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    transactionUserUpdateMany.mockReset();
    transactionUserFindFirst.mockReset();
    transactionAuditCreate.mockReset();
    prisma.$transaction.mockImplementation(async (callback: unknown) => {
      if (typeof callback !== "function") {
        return callback;
      }
      return callback({
        user: {
          updateMany: transactionUserUpdateMany,
          findFirst: transactionUserFindFirst,
        },
        auditLog: {
          create: transactionAuditCreate,
        },
      });
    });
  });

  it("atomically updates an active changed row and writes one audit marker", async () => {
    transactionUserUpdateMany.mockResolvedValueOnce({ count: 1 });
    transactionUserFindFirst.mockResolvedValueOnce({
      id: userId,
      email: "student@example.com",
      fullName: "Updated Name",
      role: "student",
      status: "active",
    });

    const result = await updateMeProfile(userId, {
      fullName: "Updated Name",
    });

    expect(transactionUserUpdateMany).toHaveBeenCalledWith({
      where: {
        id: userId,
        deletedAt: null,
        NOT: { fullName: "Updated Name" },
      },
      data: { fullName: "Updated Name" },
    });
    expect(transactionAuditCreate).toHaveBeenCalledWith({
      data: {
        actorId: userId,
        action: "user.profile_updated",
        entity: "user",
        entityId: userId,
        eventData: { fullNameChanged: true },
        schemaVersion: 1,
      },
      select: { id: true },
    });
    expect(result.fullName).toBe("Updated Name");
  });

  it("emits one audit event for concurrent identical requests", async () => {
    transactionUserUpdateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    transactionUserFindFirst.mockResolvedValue({
      id: userId,
      email: "student@example.com",
      fullName: "Updated Name",
      role: "student",
      status: "active",
    });

    await Promise.all([
      updateMeProfile(userId, { fullName: "Updated Name" }),
      updateMeProfile(userId, { fullName: "Updated Name" }),
    ]);

    expect(transactionAuditCreate).toHaveBeenCalledTimes(1);
  });

  it("cannot mutate or audit a user deleted before the atomic update", async () => {
    transactionUserUpdateMany.mockResolvedValueOnce({ count: 0 });
    transactionUserFindFirst.mockResolvedValueOnce(null);

    await expect(
      updateMeProfile(userId, { fullName: "Updated Name" }),
    ).rejects.toMatchObject({ statusCode: 404 });

    expect(transactionAuditCreate).not.toHaveBeenCalled();
  });
});
