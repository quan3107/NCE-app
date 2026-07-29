/**
 * File: tests/modules/settings/settings.service.test.ts
 * Purpose: Verify admin upload-limit settings persist through the runtime policy table.
 * Why: Admin settings are honest only when the upload service consumes their stored values.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/prisma/client.js", () => ({
  prisma: {
    fileUploadPolicy: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

const prismaModule = await import("../../../src/prisma/client.js");
const prisma = vi.mocked(prismaModule.prisma, true);
const transactionPolicyFindMany = vi.fn();
const transactionPolicyUpdate = vi.fn();
const transactionAuditCreate = vi.fn();
const { updateFileUploadLimits } = await import(
  "../../../src/modules/settings/settings.service.js"
);

const actorId = "7f6c9f72-1e95-4f36-8f06-0f0a9ed0b1c2";

describe("settings.service upload limits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    transactionPolicyFindMany.mockReset();
    transactionPolicyUpdate.mockReset();
    transactionAuditCreate.mockReset();
    prisma.$transaction.mockImplementation(async (callback: unknown) => {
      if (typeof callback !== "function") {
        return callback;
      }

      return callback({
        fileUploadPolicy: {
          findMany: transactionPolicyFindMany,
          update: transactionPolicyUpdate,
        },
        auditLog: {
          create: transactionAuditCreate,
        },
      });
    });
  });

  it("updates role policies in bytes and audits the changed roles atomically", async () => {
    transactionPolicyFindMany.mockResolvedValueOnce([
      {
        role: "student",
        maxFileSize: 25 * 1024 * 1024,
      },
    ]);
    transactionPolicyUpdate.mockResolvedValueOnce({
      role: "student",
      maxFileSize: 12 * 1024 * 1024,
    });

    const result = await updateFileUploadLimits(
      {
        limits: [{ role: "student", maxFileSizeMb: 12 }],
      },
      actorId,
    );

    expect(transactionPolicyUpdate).toHaveBeenCalledWith({
      where: { role: "student" },
      data: { maxFileSize: 12 * 1024 * 1024 },
      select: { role: true, maxFileSize: true },
    });
    expect(transactionAuditCreate).toHaveBeenCalledWith({
      data: {
        actorId,
        action: "settings.file_upload_limits_updated",
        entity: "file_upload_policy",
        entityId: "role-upload-limits",
        eventData: { changedRoles: ["student"] },
        schemaVersion: 1,
      },
      select: { id: true },
    });
    expect(result).toEqual({
      limits: [{ role: "student", maxFileSizeMb: 12 }],
    });
  });

  it("does not update or audit limits that already match persistence", async () => {
    transactionPolicyFindMany.mockResolvedValueOnce([
      {
        role: "student",
        maxFileSize: 12 * 1024 * 1024,
      },
    ]);

    const result = await updateFileUploadLimits(
      {
        limits: [{ role: "student", maxFileSizeMb: 12 }],
      },
      actorId,
    );

    expect(transactionPolicyUpdate).not.toHaveBeenCalled();
    expect(transactionAuditCreate).not.toHaveBeenCalled();
    expect(result).toEqual({
      limits: [{ role: "student", maxFileSizeMb: 12 }],
    });
  });
});
