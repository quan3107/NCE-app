/**
 * File: src/modules/files/files.service.ts
 * Purpose: Sign private R2 uploads and downloads and persist verified file metadata.
 * Why: Only server-issued, verified uploads may become accessible application files.
 */
import { randomUUID } from "crypto";
import path from "path";
import { getR2Settings } from "../../config/r2.js";
import { issueUploadToken, readUploadToken } from "./upload-intent.js";
import {
  signR2Upload,
  promoteR2Upload,
  signR2Download,
  cleanupR2Upload,
} from "./r2-storage.js";

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
const DOWNLOAD_TTL_MS = 5 * 60 * 1000;

type FileContentRecord = {
  ownerId: string;
  bucket: string;
  objectKey: string;
  mime: string;
  size: number;
};

export type CompletedSubmissionFile = {
  id: string;
  name: string;
  size: number;
  mime: string;
  checksum: string;
  bucket: string;
  objectKey: string;
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

function mimeMatchesPolicy(
  mime: string,
  allowedMimeTypes: Set<string>,
): boolean {
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

  const allowedByMime = mimeMatchesPolicy(
    normalizedMime,
    config.allowedMimeTypes,
  );
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

  const id = randomUUID();
  const objectKey = `pending/${ownerId}/${id}/${safeName}`;
  const intent = {
    id,
    ownerId,
    bucket: getR2Settings().bucket,
    objectKey,
    mime: data.mime,
    size: data.size,
    checksum: data.checksum,
    expiresAt: Date.now() + UPLOAD_TTL_MS,
  };
  const expiresAt = new Date(intent.expiresAt).toISOString();
  const uploadUrl = await signR2Upload(intent);

  return {
    uploadUrl,
    uploadToken: issueUploadToken(intent),
    method: "PUT",
    headers: {
      "Content-Type": data.mime,
    },
    bucket: intent.bucket,
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
  const intent = readUploadToken(data.uploadToken, ownerId);
  if (
    data.bucket !== intent.bucket ||
    data.objectKey !== intent.objectKey ||
    data.mime !== intent.mime ||
    data.size !== intent.size ||
    data.checksum !== intent.checksum
  ) {
    throw createHttpError(
      400,
      "File metadata does not match its upload intent.",
    );
  }
  await assertUploadAllowed({
    role,
    fileName: data.objectKey,
    mime: data.mime,
    size: data.size,
  });

  const existing = await prisma.file.findFirst({
    where: { id: intent.id, ownerId, deletedAt: null },
  });
  if (existing) {
    await cleanupR2Upload(intent).catch(() => undefined);
    return existing;
  }
  try {
    const objectKey = await promoteR2Upload(intent);
    const completed = await prisma.file.create({
      data: {
        id: intent.id,
        ownerId,
        bucket: data.bucket,
        objectKey,
        mime: data.mime,
        size: data.size,
        checksum: data.checksum,
      },
    });
    // Retain staging through failed inserts so retries can verify the bytes again.
    await cleanupR2Upload(intent).catch(() => undefined);
    return completed;
  } catch (error) {
    // An overlapping request may have committed and cleaned staging meanwhile.
    const winner = await prisma.file.findFirst({
      where: { id: intent.id, ownerId, deletedAt: null },
    });
    if (!winner) throw error;
    await cleanupR2Upload(intent).catch(() => undefined);
    return winner;
  }
}

function recordHasFileReference(
  record: Record<string, unknown>,
  fileId: string,
): boolean {
  if (record.audioFileId === fileId || record.imageFileId === fileId) {
    return true;
  }

  const files = Array.isArray(record.files) ? record.files : [];
  if (
    files.some(
      (item) =>
        typeof item === "object" &&
        item !== null &&
        (item as Record<string, unknown>).id === fileId,
    )
  ) {
    return true;
  }

  const recordings = Array.isArray(record.recordings) ? record.recordings : [];
  return recordings.some(
    (item) =>
      typeof item === "object" &&
      item !== null &&
      (item as Record<string, unknown>).fileId === fileId,
  );
}

function referencesFileId(value: unknown, fileId: string): boolean {
  if (Array.isArray(value)) {
    return value.some((item) => referencesFileId(item, fileId));
  }
  if (typeof value === "object" && value !== null) {
    const record = value as Record<string, unknown>;
    return (
      recordHasFileReference(record, fileId) ||
      Object.values(record).some((item) => referencesFileId(item, fileId))
    );
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
      ...(actor.role === UserRole.student
        ? { publishedAt: { not: null } }
        : {}),
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

function fileNameFromObjectKey(objectKey: string): string {
  return path.basename(objectKey) || "download";
}

/**
 * Resolve client file IDs to authoritative completed-upload records.
 * Submission payloads must never persist client-provided object keys or metadata.
 */
export async function getOwnedCompletedSubmissionFiles(
  fileIds: string[],
  ownerId: string,
  role: UserRole,
): Promise<CompletedSubmissionFile[]> {
  const config = await getRoleFileUploadConfig(role);
  if (fileIds.length > config.limits.max_files_per_upload) {
    throw createHttpError(400, "Too many files for one submission.", {
      max_files_per_upload: config.limits.max_files_per_upload,
    });
  }

  const records = await prisma.file.findMany({
    where: {
      id: { in: fileIds },
      ownerId,
      deletedAt: null,
    },
    select: {
      id: true,
      bucket: true,
      objectKey: true,
      mime: true,
      size: true,
      checksum: true,
    },
  });
  const recordsById = new Map(records.map((record) => [record.id, record]));
  const orderedRecords = fileIds.map((fileId) => recordsById.get(fileId));
  if (orderedRecords.some((record) => !record)) {
    throw createHttpError(
      400,
      "Only completed files owned by the student can be submitted.",
    );
  }

  const totalSize = orderedRecords.reduce(
    (sum, record) => sum + (record?.size ?? 0),
    0,
  );
  if (totalSize > config.limits.max_total_size) {
    throw createHttpError(
      400,
      "Files exceed the total submission size limit.",
      {
        max_total_size: config.limits.max_total_size,
      },
    );
  }

  await Promise.all(
    orderedRecords.map((record) =>
      assertUploadAllowed({
        role,
        fileName: record!.objectKey,
        mime: record!.mime,
        size: record!.size,
      }),
    ),
  );

  return orderedRecords.map((record) => ({
    id: record!.id,
    name: fileNameFromObjectKey(record!.objectKey),
    size: record!.size,
    mime: record!.mime,
    checksum: record!.checksum,
    bucket: record!.bucket,
    objectKey: record!.objectKey,
  }));
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
    url: await signR2Download(file.bucket, file.objectKey, file.mime),
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
    size: download.size,
  };
}
