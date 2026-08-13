/**
 * File: tests/modules/me/me.service.test.ts
 * Purpose: Verify authenticated profile updates persist and produce bounded audit data.
 * Why: Profile edits must survive reloads without copying personal names into audit logs.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/prisma/client.js", () => ({
  prisma: {
    $transaction: vi.fn(),
    user: {
      findFirst: vi.fn(),
    },
  },
}));

const prismaModule = await import("../../../src/prisma/client.js");
const prisma = vi.mocked(prismaModule.prisma, true);
const transactionUserUpdateMany = vi.fn();
const transactionUserFindFirst = vi.fn();
const transactionAuditCreate = vi.fn();
const { getMe, updateMeProfile } =
  await import("../../../src/modules/me/me.service.js");

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
      profileRevision: 1,
    });

    const result = await updateMeProfile(userId, {
      fullName: "Updated Name",
      expectedRevision: 0,
    });

    expect(transactionUserUpdateMany).toHaveBeenCalledWith({
      where: {
        id: userId,
        deletedAt: null,
        status: "active",
        profileRevision: 0,
        NOT: { fullName: "Updated Name" },
      },
      data: {
        fullName: "Updated Name",
        profileRevision: { increment: 1 },
      },
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
      profileRevision: 1,
    });

    await Promise.all([
      updateMeProfile(userId, {
        fullName: "Updated Name",
        expectedRevision: 0,
      }),
      updateMeProfile(userId, {
        fullName: "Updated Name",
        expectedRevision: 0,
      }),
    ]);

    expect(transactionAuditCreate).toHaveBeenCalledTimes(1);
  });

  it("cannot mutate or audit a user deleted before the atomic update", async () => {
    transactionUserUpdateMany.mockResolvedValueOnce({ count: 0 });
    transactionUserFindFirst.mockResolvedValueOnce(null);

    await expect(
      updateMeProfile(userId, {
        fullName: "Updated Name",
        expectedRevision: 0,
      }),
    ).rejects.toMatchObject({ statusCode: 404 });

    expect(transactionAuditCreate).not.toHaveBeenCalled();
  });

  it("rejects a profile write when the database user is suspended", async () => {
    transactionUserUpdateMany.mockResolvedValueOnce({ count: 0 });
    transactionUserFindFirst.mockResolvedValueOnce({
      id: userId,
      email: "student@example.com",
      fullName: "Original Name",
      role: "student",
      status: "suspended",
      profileRevision: 0,
    });

    await expect(
      updateMeProfile(userId, {
        fullName: "Updated Name",
        expectedRevision: 0,
      }),
    ).rejects.toMatchObject({ statusCode: 403 });

    expect(transactionAuditCreate).not.toHaveBeenCalled();
  });

  it("rejects a stale profile revision without overwriting the database winner", async () => {
    transactionUserUpdateMany.mockResolvedValueOnce({ count: 0 });
    transactionUserFindFirst.mockResolvedValueOnce({
      id: userId,
      email: "student@example.com",
      fullName: "Winning Name",
      role: "student",
      status: "active",
      profileRevision: 2,
    });

    await expect(
      updateMeProfile(userId, {
        fullName: "Stale Name",
        expectedRevision: 1,
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(transactionAuditCreate).not.toHaveBeenCalled();
  });
});

describe("me.service reads", () => {
  it("rejects a suspended database user before returning account data", async () => {
    prisma.user.findFirst.mockResolvedValueOnce({
      id: userId,
      email: "student@example.com",
      fullName: "Suspended Student",
      role: "student",
      status: "suspended",
      enrollments: [],
    } as never);

    await expect(getMe(userId)).rejects.toMatchObject({
      statusCode: 403,
      message: "Active account required.",
    });
  });
});
