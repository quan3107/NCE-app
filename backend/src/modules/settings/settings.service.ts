/**
 * File: src/modules/settings/settings.service.ts
 * Purpose: Read and update admin-managed runtime settings.
 * Why: The settings UI must persist values consumed by upload enforcement.
 */
import { Prisma } from "../../prisma/index.js";

import { prisma } from "../../prisma/client.js";
import { createHttpError } from "../../utils/httpError.js";
import { writeAuditLog } from "../audit-logs/audit-logs.service.js";
import type {
  FileUploadLimitsPayload,
  UpdateFileUploadLimitsPayload,
  UploadLimitRole,
} from "./settings.schema.js";

const BYTES_PER_MEBIBYTE = 1024 * 1024;
const UPDATE_ORDER: UploadLimitRole[] = ["student", "teacher", "admin"];

type AuthorizationClient = Pick<Prisma.TransactionClient, "$queryRaw">;

async function assertActiveAdmin(
  actorId: string,
  client: AuthorizationClient,
  lockMode: "share" | "update",
): Promise<void> {
  // Keep authorization and row locking in one statement so a concurrent
  // demotion, suspension, or deletion cannot pass between check and use.
  const actors =
    lockMode === "update"
      ? await client.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id"
      FROM "users"
      WHERE "id" = ${actorId}::uuid
        AND "role" = 'admin'::"UserRole"
        AND "status" = 'active'::"UserStatus"
        AND "deletedAt" IS NULL
      FOR UPDATE
    `)
      : await client.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id"
      FROM "users"
      WHERE "id" = ${actorId}::uuid
        AND "role" = 'admin'::"UserRole"
        AND "status" = 'active'::"UserStatus"
        AND "deletedAt" IS NULL
      FOR SHARE
    `);
  if (!actors[0]) {
    throw createHttpError(403, "Active administrator account required.");
  }
}

const toPayload = (
  limits: Array<{ role: "admin" | "student" | "teacher"; maxFileSize: number }>,
): FileUploadLimitsPayload => {
  const roles = new Set(limits.map((limit) => limit.role));
  const isCanonical =
    limits.length === UPDATE_ORDER.length &&
    roles.size === UPDATE_ORDER.length &&
    UPDATE_ORDER.every((role) => roles.has(role)) &&
    limits.every(
      (limit) =>
        Number.isSafeInteger(limit.maxFileSize) &&
        limit.maxFileSize % BYTES_PER_MEBIBYTE === 0 &&
        limit.maxFileSize >= BYTES_PER_MEBIBYTE &&
        limit.maxFileSize <= 100 * BYTES_PER_MEBIBYTE,
    );
  if (!isCanonical) {
    throw createHttpError(
      500,
      "Stored file upload policies are not canonical.",
    );
  }

  return {
    limits: limits.map((limit) => ({
      role: limit.role,
      maxFileSizeMib: limit.maxFileSize / BYTES_PER_MEBIBYTE,
    })),
  };
};

export async function getFileUploadLimits(
  actorId: string,
): Promise<FileUploadLimitsPayload> {
  const limits = await prisma.$transaction(async (transaction) => {
    await assertActiveAdmin(actorId, transaction, "share");
    return transaction.fileUploadPolicy.findMany({
      select: { role: true, maxFileSize: true },
      orderBy: { role: "asc" },
    });
  });

  return toPayload(limits);
}

export async function updateFileUploadLimits(
  input: UpdateFileUploadLimitsPayload,
  actorId: string,
): Promise<FileUploadLimitsPayload> {
  const limits = await prisma.$transaction(async (transaction) => {
    await assertActiveAdmin(actorId, transaction, "update");
    const changedRoles: UploadLimitRole[] = [];

    for (const role of UPDATE_ORDER) {
      const update = input.updates[role];
      if (!update) {
        continue;
      }

      const expectedMaxFileSize =
        update.expectedMaxFileSizeMib * BYTES_PER_MEBIBYTE;
      const maxFileSize = update.maxFileSizeMib * BYTES_PER_MEBIBYTE;
      const changesValue = expectedMaxFileSize !== maxFileSize;
      let matchedExpectedValue: boolean;
      if (changesValue) {
        const [result] = await transaction.$queryRaw<Array<{ updated: boolean }>>`
          SELECT app.update_file_upload_policy(
            ${role},
            ${expectedMaxFileSize},
            ${maxFileSize}
          ) AS updated
        `;
        matchedExpectedValue = Boolean(result?.updated);
      } else {
        const [result] = await transaction.$queryRaw<Array<{ matched: boolean }>>`
          SELECT TRUE AS matched
          FROM public.file_upload_policies
          WHERE role = ${role}::public."UserRole"
            AND max_file_size = ${expectedMaxFileSize}
          FOR SHARE
        `;
        matchedExpectedValue = Boolean(result?.matched);
      }

      if (!matchedExpectedValue) {
        throw createHttpError(
          409,
          "File upload limits changed; reload before saving.",
          { role },
        );
      }
      if (changesValue) {
        changedRoles.push(role);
      }
    }

    if (changedRoles.length > 0) {
      await writeAuditLog(
        {
          actorId,
          action: "settings.file_upload_limits_updated",
          entity: "file_upload_policy",
          entityId: "role-upload-limits",
          eventData: { changedRoles },
        },
        transaction,
      );
    }

    return transaction.fileUploadPolicy.findMany({
      select: { role: true, maxFileSize: true },
      orderBy: { role: "asc" },
    });
  });

  return toPayload(limits);
}
