/**
 * File: src/modules/settings/settings.service.ts
 * Purpose: Read and update admin-managed runtime settings.
 * Why: The settings UI must persist values consumed by upload enforcement.
 */
import { prisma } from "../../prisma/client.js";
import { createHttpError } from "../../utils/httpError.js";
import { writeAuditLog } from "../audit-logs/audit-logs.service.js";
import type {
  FileUploadLimitsPayload,
  UpdateFileUploadLimitsPayload,
  UploadLimitRole,
} from "./settings.schema.js";

const BYTES_PER_MEGABYTE = 1024 * 1024;
const UPDATE_ORDER: UploadLimitRole[] = ["student", "teacher", "admin"];

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
        limit.maxFileSize % BYTES_PER_MEGABYTE === 0 &&
        limit.maxFileSize >= BYTES_PER_MEGABYTE &&
        limit.maxFileSize <= 100 * BYTES_PER_MEGABYTE,
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
      maxFileSizeMb: limit.maxFileSize / BYTES_PER_MEGABYTE,
    })),
  };
};

export async function getFileUploadLimits(): Promise<FileUploadLimitsPayload> {
  const limits = await prisma.fileUploadPolicy.findMany({
    select: { role: true, maxFileSize: true },
    orderBy: { role: "asc" },
  });

  return toPayload(limits);
}

export async function updateFileUploadLimits(
  input: UpdateFileUploadLimitsPayload,
  actorId: string,
): Promise<FileUploadLimitsPayload> {
  const limits = await prisma.$transaction(async (transaction) => {
    const changedRoles: UploadLimitRole[] = [];

    for (const role of UPDATE_ORDER) {
      const update = input.updates[role];
      if (!update || update.expectedMaxFileSizeMb === update.maxFileSizeMb) {
        continue;
      }

      const expectedMaxFileSize =
        update.expectedMaxFileSizeMb * BYTES_PER_MEGABYTE;
      const maxFileSize = update.maxFileSizeMb * BYTES_PER_MEGABYTE;
      const [result] = await transaction.$queryRaw<Array<{ updated: boolean }>>`
        SELECT app.update_file_upload_policy(
          ${role},
          ${expectedMaxFileSize},
          ${maxFileSize}
        ) AS updated
      `;

      if (!result?.updated) {
        throw createHttpError(
          409,
          "File upload limits changed; reload before saving.",
          { role },
        );
      }
      changedRoles.push(role);
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
