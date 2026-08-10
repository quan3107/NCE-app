/**
 * File: src/modules/file-upload-config/file-upload-config.service.ts
 * Purpose: Resolve role-based file upload limits and allowed file types.
 * Why: Centralizes config reads so frontend and upload endpoints share one source of truth.
 */

import { logger } from "../../config/logger.js";
import { prisma } from "../../prisma/client.js";
import type { UserRole } from "../../prisma/index.js";

export type FileUploadLimits = {
  max_file_size: number;
  max_total_size: number;
  max_files_per_upload: number;
};

export type AllowedFileType = {
  mime_type: string;
  extensions: string[];
  label: string;
  accept_token: string;
};

export type RoleFileUploadConfig = {
  role: UserRole;
  limits: FileUploadLimits;
  allowedTypes: AllowedFileType[];
  accept: string;
  typeLabel: string;
  allowedMimeTypes: Set<string>;
  allowedExtensions: Set<string>;
};

function normalizeExtension(value: string): string {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) {
    return "";
  }
  return trimmed.startsWith(".") ? trimmed : `.${trimmed}`;
}

function normalizeAllowedType(type: AllowedFileType): AllowedFileType {
  return {
    mime_type: type.mime_type.trim().toLowerCase(),
    extensions: type.extensions
      .map(normalizeExtension)
      .filter((extension) => extension.length > 1),
    label: type.label.trim(),
    accept_token: type.accept_token.trim(),
  };
}

const MIME_TYPE_PATTERN = /^[a-z0-9!#$&^_.+-]+\/(?:[a-z0-9!#$&^_.+-]+|\*)$/;
const EXTENSION_PATTERN = /^\.[a-z0-9]+$/;

function invalidAllowedTypeReason(type: AllowedFileType): string | null {
  if (!MIME_TYPE_PATTERN.test(type.mime_type)) {
    return "mime_type_blank";
  }
  if (
    type.extensions.length === 0 ||
    type.extensions.some((extension) => !EXTENSION_PATTERN.test(extension))
  ) {
    return "extensions_missing";
  }
  if (!type.label) {
    return "label_blank";
  }
  if (
    !EXTENSION_PATTERN.test(type.accept_token) &&
    !MIME_TYPE_PATTERN.test(type.accept_token)
  ) {
    return "accept_token_blank";
  }
  return null;
}

function toTypeToken(type: AllowedFileType): string {
  const token = type.accept_token;
  if (token.startsWith(".")) {
    return token.slice(1).toUpperCase();
  }
  if (token.endsWith("/*")) {
    return token.slice(0, -2);
  }
  return type.label.toLowerCase();
}

function buildTypeLabel(allowedTypes: AllowedFileType[]): string {
  const tokens = allowedTypes
    .map(toTypeToken)
    .filter((token) => token.length > 0);

  if (tokens.length === 0) {
    return "files";
  }

  if (tokens.length === 1) {
    return `${tokens[0]} files`;
  }

  if (tokens.length === 2) {
    return `${tokens[0]} or ${tokens[1]} files`;
  }

  const prefix = `${tokens.slice(0, -1).join(", ")}, or ${tokens[tokens.length - 1]}`;
  return `${prefix} files`;
}

function buildRoleConfig(
  role: UserRole,
  limits: FileUploadLimits,
  allowedTypesInput: AllowedFileType[],
): RoleFileUploadConfig {
  const allowedTypes = allowedTypesInput.map(normalizeAllowedType);
  for (const type of allowedTypes) {
    const invalidReason = invalidAllowedTypeReason(type);
    if (invalidReason) {
      return throwUnavailablePolicy(role, invalidReason);
    }
  }
  const accept = allowedTypes.map((type) => type.accept_token).join(",");
  const typeLabel = buildTypeLabel(allowedTypes);

  const allowedMimeTypes = new Set<string>();
  const allowedExtensions = new Set<string>();

  for (const type of allowedTypes) {
    allowedMimeTypes.add(type.mime_type);
    for (const extension of type.extensions) {
      allowedExtensions.add(extension);
    }
  }

  return {
    role,
    limits,
    allowedTypes,
    accept,
    typeLabel,
    allowedMimeTypes,
    allowedExtensions,
  };
}

function throwUnavailablePolicy(role: UserRole, reason: string): never {
  logger.error({ role, reason }, "File upload policy unavailable");
  const error = new Error("File upload policy is unavailable.");
  error.name = "FileUploadPolicyUnavailableError";
  throw error;
}

export async function getRoleFileUploadConfig(
  role: UserRole,
): Promise<RoleFileUploadConfig> {
  const policy = await prisma.fileUploadPolicy.findUnique({
    where: { role },
    include: {
      allowedTypes: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      },
    },
  });

  if (!policy) {
    return throwUnavailablePolicy(role, "policy_not_found");
  }

  if (policy.allowedTypes.length === 0) {
    return throwUnavailablePolicy(role, "allowed_types_missing");
  }

  return buildRoleConfig(
    role,
    {
      max_file_size: policy.maxFileSize,
      max_total_size: policy.maxTotalSize,
      max_files_per_upload: policy.maxFilesPerUpload,
    },
    policy.allowedTypes.map((type) => ({
      mime_type: type.mimeType,
      extensions: type.extensions,
      label: type.label,
      accept_token: type.acceptToken,
    })),
  );
}

export async function getFileUploadLimitsForRole(role: UserRole): Promise<{
  limits: FileUploadLimits;
}> {
  const config = await getRoleFileUploadConfig(role);
  return {
    limits: config.limits,
  };
}

export async function getAllowedFileTypesForRole(role: UserRole): Promise<{
  allowed_types: AllowedFileType[];
  accept: string;
  type_label: string;
}> {
  const config = await getRoleFileUploadConfig(role);
  return {
    allowed_types: config.allowedTypes,
    accept: config.accept,
    type_label: config.typeLabel,
  };
}
