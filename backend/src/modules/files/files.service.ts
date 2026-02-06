/**
 * File: src/modules/files/files.service.ts
 * Purpose: Generate mock signed upload intents and persist completed file metadata.
 * Why: Provides PRD-aligned endpoints without requiring storage infrastructure yet.
 */
import { randomUUID } from "crypto";
import path from "path";

import { prisma } from "../../prisma/client.js";
import type { UserRole } from "../../prisma/index.js";
import { createHttpError } from "../../utils/httpError.js";
import { getRoleFileUploadConfig } from "../file-upload-config/file-upload-config.service.js";
import { fileCompleteSchema, fileSignSchema } from "./files.schema.js";

const UPLOAD_TTL_MS = 15 * 60 * 1000;
const DEFAULT_BUCKET = "nce-mock-uploads";

function sanitizeFileName(fileName: string): string {
  const baseName = path.basename(fileName.trim());
  const safeName = baseName.replace(/[^a-zA-Z0-9._-]/g, "_");

  if (!safeName) {
    throw createHttpError(400, "fileName must include a valid base name");
  }

  return safeName;
}

function normalizeMime(mime: string): string {
  return mime.trim().toLowerCase();
}

function toExtension(value: string): string {
  return path.extname(value.trim().toLowerCase());
}

function mimeMatchesPolicy(mime: string, allowedMimeTypes: Set<string>): boolean {
  if (allowedMimeTypes.has(mime)) {
    return true;
  }

  const slashIndex = mime.indexOf("/");
  if (slashIndex <= 0) {
    return false;
  }

  const wildcardMime = `${mime.slice(0, slashIndex)}/*`;
  return allowedMimeTypes.has(wildcardMime);
}

async function assertUploadAllowed({
  role,
  fileName,
  mime,
  size,
}: {
  role: UserRole;
  fileName: string;
  mime: string;
  size: number;
}): Promise<void> {
  const config = await getRoleFileUploadConfig(role);
  const normalizedMime = normalizeMime(mime);
  const extension = toExtension(fileName);

  if (size > config.limits.max_file_size) {
    throw createHttpError(400, "File exceeds the maximum allowed size.", {
      role,
      size,
      max_file_size: config.limits.max_file_size,
    });
  }

  const allowedByMime = mimeMatchesPolicy(normalizedMime, config.allowedMimeTypes);
  const allowedByExtension =
    extension.length > 0 && config.allowedExtensions.has(extension);

  if (!allowedByMime && !allowedByExtension) {
    throw createHttpError(400, "Unsupported file type.", {
      role,
      mime: normalizedMime,
      extension: extension || null,
      allowed_types: config.allowedTypes.map((type) => ({
        mime_type: type.mime_type,
        extensions: type.extensions,
      })),
    });
  }
}

export async function signFileUpload(
  payload: unknown,
  ownerId: string,
  role: UserRole,
) {
  const data = fileSignSchema.parse(payload);
  const safeName = sanitizeFileName(data.fileName);
  await assertUploadAllowed({
    role,
    fileName: safeName,
    mime: data.mime,
    size: data.size,
  });

  const objectKey = `uploads/${ownerId}/${randomUUID()}/${safeName}`;
  const expiresAt = new Date(Date.now() + UPLOAD_TTL_MS).toISOString();
  // Mock URL until storage signing is implemented for real buckets.
  const uploadUrl = `https://storage.mock/${DEFAULT_BUCKET}/${objectKey}`;

  return {
    uploadUrl,
    method: "PUT",
    headers: {
      "Content-Type": data.mime,
    },
    bucket: DEFAULT_BUCKET,
    objectKey,
    expiresAt,
  };
}

export async function completeFileUpload(
  payload: unknown,
  ownerId: string,
  role: UserRole,
) {
  const data = fileCompleteSchema.parse(payload);
  await assertUploadAllowed({
    role,
    fileName: data.objectKey,
    mime: data.mime,
    size: data.size,
  });

  return prisma.file.create({
    data: {
      ownerId,
      bucket: data.bucket,
      objectKey: data.objectKey,
      mime: data.mime,
      size: data.size,
      checksum: data.checksum,
    },
  });
}
