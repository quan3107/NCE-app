/**
 * File: tests/modules/file-upload-config/file-upload-config.service.test.ts
 * Purpose: Validate file upload config mapping and fallback behavior.
 * Why: Ensures config endpoints return a stable payload even when DB rows are missing.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/prisma/client.js", () => ({
  prisma: {
    fileUploadPolicy: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("../../../src/config/logger.js", () => ({
  logger: {
    warn: vi.fn(),
  },
}));

const prismaModule = await import("../../../src/prisma/client.js");
const loggerModule = await import("../../../src/config/logger.js");
const prisma = vi.mocked(prismaModule.prisma, true);
const logger = vi.mocked(loggerModule.logger, true);

const {
  getAllowedFileTypesForRole,
  getFileUploadLimitsForRole,
  getRoleFileUploadConfig,
} = await import("../../../src/modules/file-upload-config/file-upload-config.service.js");

describe("file-upload-config.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps database policy rows into endpoint-friendly payloads", async () => {
    prisma.fileUploadPolicy.findUnique.mockResolvedValue({
      id: "policy-1",
      role: "student",
      maxFileSize: 123,
      maxTotalSize: 456,
      maxFilesPerUpload: 3,
      allowedTypes: [
        {
          mimeType: "application/pdf",
          extensions: [".pdf"],
          label: "PDF Document",
          acceptToken: ".pdf",
          sortOrder: 1,
          createdAt: new Date("2026-02-06T00:00:00.000Z"),
        },
        {
          mimeType: "audio/*",
          extensions: [".mp3"],
          label: "Audio Files",
          acceptToken: "audio/*",
          sortOrder: 2,
          createdAt: new Date("2026-02-06T00:00:00.000Z"),
        },
      ],
    });

    const config = await getRoleFileUploadConfig("student");
    const limitsPayload = await getFileUploadLimitsForRole("student");
    const allowedTypesPayload = await getAllowedFileTypesForRole("student");

    expect(config.accept).toBe(".pdf,audio/*");
    expect(config.typeLabel).toBe("PDF or audio files");
    expect(config.allowedMimeTypes.has("application/pdf")).toBe(true);
    expect(config.allowedMimeTypes.has("audio/*")).toBe(true);
    expect(config.allowedExtensions.has(".pdf")).toBe(true);

    expect(limitsPayload).toEqual({
      limits: {
        max_file_size: 123,
        max_total_size: 456,
        max_files_per_upload: 3,
      },
    });

    expect(allowedTypesPayload).toEqual({
      allowed_types: [
        {
          mime_type: "application/pdf",
          extensions: [".pdf"],
          label: "PDF Document",
          accept_token: ".pdf",
        },
        {
          mime_type: "audio/*",
          extensions: [".mp3"],
          label: "Audio Files",
          accept_token: "audio/*",
        },
      ],
      accept: ".pdf,audio/*",
      type_label: "PDF or audio files",
    });
  });

  it("returns fallback defaults when role policy is missing", async () => {
    prisma.fileUploadPolicy.findUnique.mockResolvedValue(null);

    const limits = await getFileUploadLimitsForRole("teacher");
    const allowedTypes = await getAllowedFileTypesForRole("teacher");

    expect(limits).toEqual({
      limits: {
        max_file_size: 25 * 1024 * 1024,
        max_total_size: 100 * 1024 * 1024,
        max_files_per_upload: 5,
      },
    });

    expect(allowedTypes.accept).toBe(".pdf,.doc,.docx,audio/*,image/*");
    expect(allowedTypes.type_label).toBe("PDF, DOC, DOCX, audio, or image files");
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ role: "teacher", reason: "policy_not_found" }),
      "Using fallback file upload policy",
    );
  });
});
