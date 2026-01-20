/**
 * File: src/modules/files/files.service.ts
 * Purpose: Generate mock signed upload intents and persist completed file metadata.
 * Why: Provides PRD-aligned endpoints without requiring storage infrastructure yet.
 */
import { randomUUID } from "crypto";
import path from "path";

import { prisma } from "../../prisma/client.js";
import { createHttpError } from "../../utils/httpError.js";
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

export function signFileUpload(payload: unknown, ownerId: string) {
  const data = fileSignSchema.parse(payload);
  const safeName = sanitizeFileName(data.fileName);
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
) {
  const data = fileCompleteSchema.parse(payload);

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
