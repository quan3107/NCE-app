/**
 * File: src/modules/settings/settings.service.ts
 * Purpose: Read and update admin-managed runtime settings.
 * Why: The settings UI must persist values consumed by upload enforcement.
 */
import { prisma } from "../../prisma/client.js";
import { writeAuditLog } from "../audit-logs/audit-logs.service.js";
import type {
  FileUploadLimitsPayload,
  UploadLimitRole,
} from "./settings.schema.js";

const BYTES_PER_MEGABYTE = 1024 * 1024;

const toPayload = (
  limits: Array<{ role: "admin" | "student" | "teacher"; maxFileSize: number }>,
): FileUploadLimitsPayload => ({
  limits: limits.map((limit) => ({
    role: limit.role,
    maxFileSizeMb: Math.round(limit.maxFileSize / BYTES_PER_MEGABYTE),
  })),
});

export async function getFileUploadLimits(): Promise<FileUploadLimitsPayload> {
  const limits = await prisma.fileUploadPolicy.findMany({
    select: { role: true, maxFileSize: true },
    orderBy: { role: "asc" },
  });

  return toPayload(limits);
}

export async function updateFileUploadLimits(
  input: FileUploadLimitsPayload,
  actorId: string,
): Promise<FileUploadLimitsPayload> {
  const limits = await prisma.$transaction(async (transaction) => {
    const existing = await transaction.fileUploadPolicy.findMany({
      where: {
        role: {
          in: input.limits.map((limit) => limit.role),
        },
      },
      select: { role: true, maxFileSize: true },
    });
    const existingByRole = new Map(
      existing.map((limit) => [limit.role, limit]),
    );
    const saved = [];
    const changedRoles: UploadLimitRole[] = [];

    for (const limit of input.limits) {
      const maxFileSize = limit.maxFileSizeMb * BYTES_PER_MEGABYTE;
      const current = existingByRole.get(limit.role);
      if (current?.maxFileSize === maxFileSize) {
        saved.push(current);
        continue;
      }

      saved.push(
        await transaction.fileUploadPolicy.update({
          where: { role: limit.role },
          data: { maxFileSize },
          select: { role: true, maxFileSize: true },
        }),
      );
      changedRoles.push(limit.role);
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

    return saved;
  });

  return toPayload(limits);
}
