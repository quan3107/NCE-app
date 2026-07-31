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
const transactionUserFindFirst = vi.fn();
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
    transactionUserFindFirst.mockReset();
    transactionPolicyFindMany.mockReset();
    transactionAuditCreate.mockReset();
    prisma.$transaction.mockImplementation(async (callback: unknown) => {
      if (typeof callback !== "function") {
        return callback;
      }

      return callback({
        $queryRaw: transactionQueryRaw,
        user: {
          findFirst: transactionUserFindFirst,
        },
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
    transactionQueryRaw
      .mockResolvedValueOnce([{ id: actorId }])
      .mockResolvedValue([{ updated: true }]);
    transactionUserFindFirst.mockResolvedValueOnce({ id: actorId });
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
          teacher: { expectedMaxFileSizeMib: 25, maxFileSizeMib: 30 },
          student: { expectedMaxFileSizeMib: 10, maxFileSizeMib: 12 },
        },
      },
      actorId,
    );

    expect(transactionQueryRaw).toHaveBeenCalledTimes(3);
    expect(
      transactionQueryRaw.mock.calls.slice(1).map((call) => call[1]),
    ).toEqual(["student", "teacher"]);
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
        { role: "admin", maxFileSizeMib: 50 },
        { role: "student", maxFileSizeMib: 12 },
        { role: "teacher", maxFileSizeMib: 30 },
      ],
    });
  });

  it("returns 409 without auditing when the expected value is stale", async () => {
    transactionQueryRaw
      .mockResolvedValueOnce([{ id: actorId }])
      .mockResolvedValueOnce([{ updated: false }]);
    transactionUserFindFirst.mockResolvedValueOnce({ id: actorId });

    await expect(
      updateFileUploadLimits(
        {
          updates: {
            student: { expectedMaxFileSizeMib: 10, maxFileSizeMib: 12 },
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
    transactionQueryRaw.mockResolvedValueOnce([{ id: actorId }]);
    transactionUserFindFirst.mockResolvedValueOnce({ id: actorId });
    transactionPolicyFindMany.mockResolvedValue([
      { role: "admin", maxFileSize: 50 * 1024 * 1024 },
      { role: "student", maxFileSize: 12 * 1024 * 1024 },
      { role: "teacher", maxFileSize: 25 * 1024 * 1024 },
    ]);

    await updateFileUploadLimits(
      {
        updates: {
          student: { expectedMaxFileSizeMib: 12, maxFileSizeMib: 12 },
        },
      },
      actorId,
    );

    expect(transactionQueryRaw).toHaveBeenCalledTimes(1);
    expect(transactionAuditCreate).not.toHaveBeenCalled();
  });

  it("authorizes and locks the database actor before a no-op update", async () => {
    transactionQueryRaw.mockResolvedValueOnce([{ id: actorId }]);
    transactionUserFindFirst.mockResolvedValueOnce(null);

    await expect(
      updateFileUploadLimits(
        {
          updates: {
            student: { expectedMaxFileSizeMib: 12, maxFileSizeMib: 12 },
          },
        },
        actorId,
      ),
    ).rejects.toMatchObject({ statusCode: 403 });

    expect(transactionQueryRaw).toHaveBeenCalledTimes(1);
    expect(transactionPolicyFindMany).not.toHaveBeenCalled();
    expect(transactionAuditCreate).not.toHaveBeenCalled();
  });

  it("rejects a stale demoted admin claim on GET", async () => {
    prisma.user = {
      findFirst: vi.fn().mockResolvedValue(null),
    } as never;

    await expect(getFileUploadLimits(actorId)).rejects.toMatchObject({
      statusCode: 403,
    });
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

    prisma.user = {
      findFirst: vi.fn().mockResolvedValue({ id: actorId }),
    } as never;

    await expect(getFileUploadLimits(actorId)).rejects.toMatchObject({
      statusCode: 500,
      message: "Stored file upload policies are not canonical.",
    });
  });
});
