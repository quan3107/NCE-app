/**
 * File: tests/modules/me/me.service.test.ts
 * Purpose: Verify authenticated profile updates persist and produce bounded audit data.
 * Why: Profile edits must survive reloads without copying personal names into audit logs.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/prisma/client.js", () => ({
  prisma: {
    user: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}));

const prismaModule = await import("../../../src/prisma/client.js");
const prisma = vi.mocked(prismaModule.prisma, true);
const { updateMeProfile } = await import(
  "../../../src/modules/me/me.service.js"
);

const userId = "7f6c9f72-1e95-4f36-8f06-0f0a9ed0b1c2";

describe("me.service profile updates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("persists a normalized full name and audits only the change marker", async () => {
    prisma.user.findFirst.mockResolvedValueOnce({
      id: userId,
      email: "student@example.com",
      fullName: "Old Name",
      role: "student",
      status: "active",
    });
    prisma.user.update.mockResolvedValueOnce({
      id: userId,
      email: "student@example.com",
      fullName: "Updated Name",
      role: "student",
      status: "active",
    });

    const result = await updateMeProfile(userId, {
      fullName: "  Updated Name  ",
    });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: userId },
      data: { fullName: "Updated Name" },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        status: true,
      },
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
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
});
