/**
 * File: tests/modules/settings/settings.service.test.ts
 * Purpose: Verify admin upload-limit settings persist through the runtime policy table.
 * Why: Admin settings are honest only when the upload service consumes their stored values.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/prisma/client.js", () => ({
  prisma: {
    $transaction: vi.fn(),
  },
}));

const prismaModule = await import("../../../src/prisma/client.js");
const prisma = vi.mocked(prismaModule.prisma, true);
const transactionQueryRaw = vi.fn();
const transactionPolicyFindMany = vi.fn();
const transactionAuditCreate = vi.fn();
const { updateFileUploadLimits } = await import(
  "../../../src/modules/settings/settings.service.js"
);
const { getFileUploadLimits } = await import(
  "../../../src/modules/settings/settings.service.js"
);

const actorId = "7f6c9f72-1e95-4f36-8f06-0f0a9ed0b1c2";

describe("settings.service upload limits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    transactionQueryRaw.mockReset();
    transactionPolicyFindMany.mockReset();
    transactionAuditCreate.mockReset();
    prisma.$transaction.mockImplementation(async (callback: unknown) => {
      if (typeof callback !== "function") {
        return callback;
      }

      return callback({
        $queryRaw: transactionQueryRaw,
        fileUploadPolicy: {
          findMany: transactionPolicyFindMany,
        },
        auditLog: {
          create: transactionAuditCreate,
        },
      });
    });
  });

  it("updates dirty roles in canonical order and audits them atomically", async () => {
    transactionQueryRaw.mockResolvedValue([{ updated: true }]);
    transactionPolicyFindMany.mockResolvedValue([
      {
        role: "admin",
        maxFileSize: 50 * 1024 * 1024,
      },
      {
        role: "student",
        maxFileSize: 12 * 1024 * 1024,
      },
      {
        role: "teacher",
        maxFileSize: 30 * 1024 * 1024,
      },
    ]);

    const result = await updateFileUploadLimits(
      {
        updates: {
          teacher: { expectedMaxFileSizeMb: 25, maxFileSizeMb: 30 },
          student: { expectedMaxFileSizeMb: 10, maxFileSizeMb: 12 },
        },
      },
      actorId,
    );

    expect(transactionQueryRaw).toHaveBeenCalledTimes(2);
    expect(transactionQueryRaw.mock.calls.map((call) => call[1])).toEqual([
      "student",
      "teacher",
    ]);
    expect(transactionAuditCreate).toHaveBeenCalledWith({
      data: {
        actorId,
        action: "settings.file_upload_limits_updated",
        entity: "file_upload_policy",
        entityId: "role-upload-limits",
        eventData: { changedRoles: ["student", "teacher"] },
        schemaVersion: 1,
      },
      select: { id: true },
    });
    expect(result).toEqual({
      limits: [
        { role: "admin", maxFileSizeMb: 50 },
        { role: "student", maxFileSizeMb: 12 },
        { role: "teacher", maxFileSizeMb: 30 },
      ],
    });
  });

  it("returns 409 without auditing when the expected value is stale", async () => {
    transactionQueryRaw.mockResolvedValueOnce([{ updated: false }]);

    await expect(
      updateFileUploadLimits(
        {
          updates: {
            student: { expectedMaxFileSizeMb: 10, maxFileSizeMb: 12 },
          },
        },
        actorId,
      ),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: "File upload limits changed; reload before saving.",
    });

    expect(transactionPolicyFindMany).not.toHaveBeenCalled();
    expect(transactionAuditCreate).not.toHaveBeenCalled();
  });

  it("does not write or audit an unchanged dirty value", async () => {
    transactionPolicyFindMany.mockResolvedValue([
      { role: "admin", maxFileSize: 50 * 1024 * 1024 },
      { role: "student", maxFileSize: 12 * 1024 * 1024 },
      { role: "teacher", maxFileSize: 25 * 1024 * 1024 },
    ]);

    await updateFileUploadLimits(
      {
        updates: {
          student: { expectedMaxFileSizeMb: 12, maxFileSizeMb: 12 },
        },
      },
      actorId,
    );

    expect(transactionQueryRaw).not.toHaveBeenCalled();
    expect(transactionAuditCreate).not.toHaveBeenCalled();
  });

  it.each([
    [
      "a fractional MiB value",
      [
        { role: "admin", maxFileSize: 50 * 1024 * 1024 },
        { role: "student", maxFileSize: 10 * 1024 * 1024 + 1 },
        { role: "teacher", maxFileSize: 25 * 1024 * 1024 },
      ],
    ],
    [
      "an incomplete role set",
      [
        { role: "admin", maxFileSize: 50 * 1024 * 1024 },
        { role: "student", maxFileSize: 10 * 1024 * 1024 },
      ],
    ],
    [
      "an out-of-range value",
      [
        { role: "admin", maxFileSize: 101 * 1024 * 1024 },
        { role: "student", maxFileSize: 10 * 1024 * 1024 },
        { role: "teacher", maxFileSize: 25 * 1024 * 1024 },
      ],
    ],
    [
      "duplicate roles",
      [
        { role: "admin", maxFileSize: 50 * 1024 * 1024 },
        { role: "student", maxFileSize: 10 * 1024 * 1024 },
        { role: "student", maxFileSize: 20 * 1024 * 1024 },
      ],
    ],
  ])("rejects stored upload limits with %s", async (_case, limits) => {
    prisma.fileUploadPolicy = {
      findMany: vi.fn().mockResolvedValue(limits),
    } as never;

    await expect(getFileUploadLimits()).rejects.toMatchObject({
      statusCode: 500,
      message: "Stored file upload policies are not canonical.",
    });
  });
});
