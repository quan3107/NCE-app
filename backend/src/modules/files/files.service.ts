/**
 * File: src/modules/files/files.service.ts
 * Purpose: Generate mock signed upload/download intents and persist completed file metadata.
 * Why: Provides PRD-aligned file endpoints without requiring storage infrastructure yet.
 */
import { randomUUID } from "crypto";
import path from "path";

import type { RequestActor } from "../../middleware/requestActor.js";
import { prisma } from "../../prisma/client.js";
import { EnrollmentRole, UserRole } from "../../prisma/index.js";
import { createHttpError } from "../../utils/httpError.js";
import { getRoleFileUploadConfig } from "../file-upload-config/file-upload-config.service.js";
import {
  fileCompleteSchema,
  fileIdParamsSchema,
  fileSignSchema,
} from "./files.schema.js";

const UPLOAD_TTL_MS = 15 * 60 * 1000;
const DOWNLOAD_TTL_MS = 15 * 60 * 1000;
const DEFAULT_BUCKET = "nce-mock-uploads";

type FileContentRecord = {
  ownerId: string;
  bucket: string;
  objectKey: string;
  mime: string;
  size: number;
};

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

function referencesFileId(value: unknown, fileId: string): boolean {
  if (typeof value === "string") {
    return value === fileId;
  }
  if (Array.isArray(value)) {
    return value.some((item) => referencesFileId(item, fileId));
  }
  if (typeof value === "object" && value !== null) {
    return Object.values(value).some((item) => referencesFileId(item, fileId));
  }
  return false;
}

function accessibleCourseWhere(actor: RequestActor) {
  return actor.role === UserRole.teacher
    ? {
        deletedAt: null,
        OR: [
          { ownerId: actor.id },
          {
            enrollments: {
              some: {
                userId: actor.id,
                roleInCourse: EnrollmentRole.teacher,
                deletedAt: null,
              },
            },
          },
        ],
      }
    : {
        deletedAt: null,
        enrollments: {
          some: {
            userId: actor.id,
            roleInCourse: EnrollmentRole.student,
            deletedAt: null,
          },
        },
      };
}

async function actorCanAccessAssignmentFile(
  fileId: string,
  actor: RequestActor,
): Promise<boolean> {
  const accessibleAssignments = await prisma.assignment.findMany({
    where: {
      deletedAt: null,
      ...(actor.role === UserRole.student ? { publishedAt: { not: null } } : {}),
      course: accessibleCourseWhere(actor),
    },
    select: {
      assignmentConfig: true,
    },
  });

  return accessibleAssignments.some((assignment) =>
    referencesFileId(assignment.assignmentConfig, fileId),
  );
}

async function actorCanAccessSubmissionFile(
  fileId: string,
  actor: RequestActor,
) {
  if (actor.role !== UserRole.teacher) {
    return false;
  }

  const submissions = await prisma.submission.findMany({
    where: {
      deletedAt: null,
      assignment: {
        deletedAt: null,
        course: accessibleCourseWhere(actor),
      },
    },
    select: {
      payload: true,
    },
  });

  return submissions.some((submission) =>
    referencesFileId(submission.payload, fileId),
  );
}

async function actorCanAccessFile(
  file: FileContentRecord,
  fileId: string,
  actor: RequestActor,
): Promise<boolean> {
  if (actor.role === UserRole.admin || file.ownerId === actor.id) {
    return true;
  }

  return (
    (await actorCanAccessAssignmentFile(fileId, actor)) ||
    (await actorCanAccessSubmissionFile(fileId, actor))
  );
}

function buildMockStorageUrl(bucket: string, objectKey: string): string {
  const encodedBucket = encodeURIComponent(bucket);
  const encodedKey = objectKey
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  return `https://storage.mock/${encodedBucket}/${encodedKey}`;
}

function fileNameFromObjectKey(objectKey: string): string {
  return path.basename(objectKey) || "download";
}

export async function getSignedFileDownload(
  fileId: string,
  actor: RequestActor,
) {
  const { id } = fileIdParamsSchema.parse({ id: fileId });
  const file = await prisma.file.findFirst({
    where: {
      id,
      deletedAt: null,
    },
    select: {
      ownerId: true,
      bucket: true,
      objectKey: true,
      mime: true,
      size: true,
    },
  });

  if (!file) {
    throw createHttpError(404, "File not found.");
  }

  const canAccess = await actorCanAccessFile(file, fileId, actor);
  if (!canAccess) {
    throw createHttpError(403, "Forbidden");
  }

  return {
    url: buildMockStorageUrl(file.bucket, file.objectKey),
    method: "GET",
    headers: {},
    fileName: fileNameFromObjectKey(file.objectKey),
    mime: file.mime,
    size: file.size,
    expiresAt: new Date(Date.now() + DOWNLOAD_TTL_MS).toISOString(),
  };
}

export async function getFileContentLocation(
  fileId: string,
  actor: RequestActor,
) {
  const download = await getSignedFileDownload(fileId, actor);

  return {
    url: download.url,
    mime: download.mime,
  };
}
