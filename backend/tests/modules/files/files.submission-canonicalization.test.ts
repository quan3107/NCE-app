/**
 * File: tests/modules/files/files.submission-canonicalization.test.ts
 * Purpose: Verify canonical file resolution for generic submissions.
 * Why: Submission payloads must use owned completed metadata and current upload limits.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/prisma/client.js", () => ({
  prisma: {
    file: { findMany: vi.fn() },
  },
}));

vi.mock("../../../src/modules/file-upload-config/file-upload-config.service.js", () => ({
  getRoleFileUploadConfig: vi.fn(),
}));

const prismaModule = await import("../../../src/prisma/client.js");
const configModule = await import(
  "../../../src/modules/file-upload-config/file-upload-config.service.js"
);
const { getOwnedCompletedSubmissionFiles } = await import(
  "../../../src/modules/files/files.service.js"
);

const prisma = vi.mocked(prismaModule.prisma, true);
const getRoleFileUploadConfig = vi.mocked(configModule.getRoleFileUploadConfig);
const ownerId = "11111111-1111-4111-8111-111111111111";
const fileIds = [
  "22222222-2222-4222-8222-222222222222",
  "33333333-3333-4333-8333-333333333333",
];

function makePolicy() {
  return {
    role: "student",
    limits: {
      max_file_size: 1_024,
      max_total_size: 4_096,
      max_files_per_upload: 5,
    },
    allowedTypes: [
      {
        mime_type: "application/pdf",
        extensions: [".pdf"],
        label: "PDF Document",
        accept_token: ".pdf",
      },
    ],
    accept: ".pdf",
    typeLabel: "PDF files",
    allowedMimeTypes: new Set(["application/pdf"]),
    allowedExtensions: new Set([".pdf"]),
  };
}

describe("files.service submission canonicalization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRoleFileUploadConfig.mockResolvedValue(makePolicy());
    prisma.file.findMany.mockResolvedValue([]);
  });

  it("returns canonical metadata for completed files owned by the student", async () => {
    prisma.file.findMany.mockResolvedValueOnce([
      {
        id: fileIds[0],
        bucket: "nce-mock-uploads",
        objectKey: "uploads/student/upload/essay.pdf",
        mime: "application/pdf",
        size: 512,
        checksum: "server-checksum",
      },
    ]);

    await expect(
      getOwnedCompletedSubmissionFiles([fileIds[0]], ownerId, "student"),
    ).resolves.toEqual([
      {
        id: fileIds[0],
        name: "essay.pdf",
        bucket: "nce-mock-uploads",
        objectKey: "uploads/student/upload/essay.pdf",
        mime: "application/pdf",
        size: 512,
        checksum: "server-checksum",
      },
    ]);
    expect(prisma.file.findMany).toHaveBeenCalledWith({
      where: {
        id: { in: [fileIds[0]] },
        ownerId,
        deletedAt: null,
      },
      select: expect.any(Object),
    });
  });

  it("rejects missing or unowned file IDs", async () => {
    await expect(
      getOwnedCompletedSubmissionFiles([fileIds[0]], ownerId, "student"),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("enforces current count and combined-size policy limits", async () => {
    getRoleFileUploadConfig.mockResolvedValueOnce({
      ...makePolicy(),
      limits: { ...makePolicy().limits, max_files_per_upload: 1 },
    });
    await expect(
      getOwnedCompletedSubmissionFiles(fileIds, ownerId, "student"),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "Too many files for one submission.",
    });

    prisma.file.findMany.mockResolvedValueOnce(
      fileIds.map((id, index) => ({
        id,
        bucket: "nce-mock-uploads",
        objectKey: `uploads/student/upload/essay-${index}.pdf`,
        mime: "application/pdf",
        size: 700,
        checksum: `checksum-${index}`,
      })),
    );
    getRoleFileUploadConfig.mockResolvedValueOnce({
      ...makePolicy(),
      limits: { ...makePolicy().limits, max_total_size: 1_000 },
    });
    await expect(
      getOwnedCompletedSubmissionFiles(fileIds, ownerId, "student"),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "Files exceed the total submission size limit.",
    });
  });
});
