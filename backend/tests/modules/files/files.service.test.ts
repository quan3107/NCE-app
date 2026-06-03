/**
 * File: tests/modules/files/files.service.test.ts
 * Purpose: Verify role-based upload policy enforcement in file signing/completion flows.
 * Why: Prevents frontend/backend validation drift for type and size checks.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/prisma/client.js", () => ({
  prisma: {
    file: {
      create: vi.fn(),
      findFirst: vi.fn(),
    },
    assignment: {
      findMany: vi.fn(),
    },
    submission: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("../../../src/modules/file-upload-config/file-upload-config.service.js", () => ({
  getRoleFileUploadConfig: vi.fn(),
}));

const prismaModule = await import("../../../src/prisma/client.js");
const fileUploadConfigModule = await import(
  "../../../src/modules/file-upload-config/file-upload-config.service.js"
);

const prisma = vi.mocked(prismaModule.prisma, true);
const getRoleFileUploadConfig = vi.mocked(fileUploadConfigModule.getRoleFileUploadConfig);

const { completeFileUpload, signFileUpload } = await import(
  "../../../src/modules/files/files.service.js"
);
const { getSignedFileDownload } = await import(
  "../../../src/modules/files/files.service.js"
);

function makePolicy() {
  return {
    role: "student",
    limits: {
      max_file_size: 1024,
      max_total_size: 4096,
      max_files_per_upload: 5,
    },
    allowedTypes: [
      {
        mime_type: "application/pdf",
        extensions: [".pdf"],
        label: "PDF Document",
        accept_token: ".pdf",
      },
      {
        mime_type: "audio/*",
        extensions: [".mp3", ".wav"],
        label: "Audio Files",
        accept_token: "audio/*",
      },
    ],
    accept: ".pdf,audio/*",
    typeLabel: "PDF or audio files",
    allowedMimeTypes: new Set(["application/pdf", "audio/*"]),
    allowedExtensions: new Set([".pdf", ".mp3", ".wav"]),
  };
}

describe("files.service upload policy enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRoleFileUploadConfig.mockResolvedValue(makePolicy());
    prisma.file.create.mockResolvedValue({ id: "file-1" });
    prisma.file.findFirst.mockResolvedValue(null);
    prisma.assignment.findMany.mockResolvedValue([]);
    prisma.submission.findMany.mockResolvedValue([]);
  });

  it("accepts exact mime type matches during signing", async () => {
    const result = await signFileUpload(
      {
        fileName: "essay.pdf",
        mime: "application/pdf",
        size: 512,
      },
      "11111111-1111-4111-8111-111111111111",
      "student",
    );

    expect(result.method).toBe("PUT");
    expect(result.bucket).toBe("nce-mock-uploads");
  });

  it("accepts wildcard mime matches during signing", async () => {
    const result = await signFileUpload(
      {
        fileName: "response.mp3",
        mime: "audio/mpeg",
        size: 512,
      },
      "11111111-1111-4111-8111-111111111111",
      "student",
    );

    expect(result.objectKey).toContain("response.mp3");
  });

  it("accepts extension fallback when mime is generic", async () => {
    const result = await signFileUpload(
      {
        fileName: "essay.PDF",
        mime: "application/octet-stream",
        size: 512,
      },
      "11111111-1111-4111-8111-111111111111",
      "student",
    );

    expect(result.objectKey.toLowerCase()).toContain("essay.pdf");
  });

  it("rejects unsupported mime and extension combinations", async () => {
    await expect(
      signFileUpload(
        {
          fileName: "script.exe",
          mime: "application/octet-stream",
          size: 512,
        },
        "11111111-1111-4111-8111-111111111111",
        "student",
      ),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "Unsupported file type.",
    });
  });

  it("rejects files that exceed per-file size", async () => {
    await expect(
      signFileUpload(
        {
          fileName: "essay.pdf",
          mime: "application/pdf",
          size: 2048,
        },
        "11111111-1111-4111-8111-111111111111",
        "student",
      ),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "File exceeds the maximum allowed size.",
    });
  });

  it("re-checks policy constraints during completion", async () => {
    await completeFileUpload(
      {
        bucket: "nce-mock-uploads",
        objectKey: "uploads/user/test.pdf",
        mime: "application/pdf",
        size: 512,
        checksum: "abc123",
      },
      "11111111-1111-4111-8111-111111111111",
      "student",
    );

    expect(prisma.file.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          objectKey: "uploads/user/test.pdf",
          mime: "application/pdf",
          size: 512,
        }),
      }),
    );
  });

  it("signs an owned file download with metadata and expiry", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    prisma.file.findFirst.mockResolvedValueOnce({
      id: "22222222-2222-4222-8222-222222222222",
      ownerId: "11111111-1111-4111-8111-111111111111",
      bucket: "nce-mock-uploads",
      objectKey: "uploads/user/recording.mp3",
      mime: "audio/mpeg",
      size: 512,
      checksum: "abc123",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      deletedAt: null,
    });

    await expect(
      getSignedFileDownload("22222222-2222-4222-8222-222222222222", {
        id: "11111111-1111-4111-8111-111111111111",
        role: "student",
        status: "active",
      }),
    ).resolves.toEqual({
      url: "https://storage.mock/nce-mock-uploads/uploads/user/recording.mp3",
      method: "GET",
      headers: {},
      fileName: "recording.mp3",
      mime: "audio/mpeg",
      size: 512,
      expiresAt: "2026-01-01T00:15:00.000Z",
    });
    vi.useRealTimers();
  });

  it("rejects signed download lookup for actors without file access", async () => {
    prisma.file.findFirst.mockResolvedValueOnce({
      id: "22222222-2222-4222-8222-222222222222",
      ownerId: "33333333-3333-4333-8333-333333333333",
      bucket: "nce-mock-uploads",
      objectKey: "uploads/user/recording.mp3",
      mime: "audio/mpeg",
      size: 512,
      checksum: "abc123",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      deletedAt: null,
    });

    await expect(
      getSignedFileDownload("22222222-2222-4222-8222-222222222222", {
        id: "11111111-1111-4111-8111-111111111111",
        role: "student",
        status: "active",
      }),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: "Forbidden",
    });
  });

  it("allows signed download lookup for files referenced by enrolled assignment configs", async () => {
    prisma.file.findFirst.mockResolvedValueOnce({
      id: "22222222-2222-4222-8222-222222222222",
      ownerId: "33333333-3333-4333-8333-333333333333",
      bucket: "nce-mock-uploads",
      objectKey: "uploads/teacher/listening.mp3",
      mime: "audio/mpeg",
      size: 512,
      checksum: "abc123",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      deletedAt: null,
    });
    prisma.assignment.findMany.mockResolvedValueOnce([
      {
        assignmentConfig: {
          version: 1,
          sections: [
            {
              id: "section-1",
              audioFileId: "22222222-2222-4222-8222-222222222222",
            },
          ],
        },
      },
    ]);

    await expect(
      getSignedFileDownload("22222222-2222-4222-8222-222222222222", {
        id: "11111111-1111-4111-8111-111111111111",
        role: "student",
        status: "active",
      }),
    ).resolves.toEqual({
      url: "https://storage.mock/nce-mock-uploads/uploads/teacher/listening.mp3",
      method: "GET",
      headers: {},
      fileName: "listening.mp3",
      mime: "audio/mpeg",
      size: 512,
      expiresAt: expect.any(String),
    });
  });

  it("scopes student assignment-file lookup to published assignments on active courses", async () => {
    prisma.file.findFirst.mockResolvedValueOnce({
      id: "22222222-2222-4222-8222-222222222222",
      ownerId: "33333333-3333-4333-8333-333333333333",
      bucket: "nce-mock-uploads",
      objectKey: "uploads/teacher/listening.mp3",
      mime: "audio/mpeg",
      size: 512,
      checksum: "abc123",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      deletedAt: null,
    });
    prisma.assignment.findMany.mockResolvedValueOnce([
      {
        assignmentConfig: {
          version: 1,
          sections: [
            {
              id: "section-1",
              audioFileId: "22222222-2222-4222-8222-222222222222",
            },
          ],
        },
      },
    ]);

    await getSignedFileDownload("22222222-2222-4222-8222-222222222222", {
      id: "11111111-1111-4111-8111-111111111111",
      role: "student",
      status: "active",
    });

    expect(prisma.assignment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          deletedAt: null,
          publishedAt: { not: null },
          course: expect.objectContaining({
            deletedAt: null,
            enrollments: {
              some: {
                userId: "11111111-1111-4111-8111-111111111111",
                roleInCourse: "student",
                deletedAt: null,
              },
            },
          }),
        }),
      }),
    );
  });

  it("allows course teachers to download files referenced by submission payloads", async () => {
    prisma.file.findFirst.mockResolvedValueOnce({
      id: "22222222-2222-4222-8222-222222222222",
      ownerId: "11111111-1111-4111-8111-111111111111",
      bucket: "nce-mock-uploads",
      objectKey: "uploads/student/essay.pdf",
      mime: "application/pdf",
      size: 512,
      checksum: "abc123",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      deletedAt: null,
    });
    prisma.assignment.findMany.mockResolvedValueOnce([]);
    prisma.submission.findMany.mockResolvedValueOnce([
      {
        payload: {
          files: [
            {
              id: "22222222-2222-4222-8222-222222222222",
              name: "essay.pdf",
            },
          ],
        },
      },
    ]);

    await expect(
      getSignedFileDownload("22222222-2222-4222-8222-222222222222", {
        id: "33333333-3333-4333-8333-333333333333",
        role: "teacher",
        status: "active",
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        url: "https://storage.mock/nce-mock-uploads/uploads/student/essay.pdf",
        fileName: "essay.pdf",
        mime: "application/pdf",
        size: 512,
      }),
    );

    expect(prisma.submission.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          deletedAt: null,
          assignment: expect.objectContaining({
            deletedAt: null,
            course: expect.objectContaining({
              deletedAt: null,
              OR: [
                { ownerId: "33333333-3333-4333-8333-333333333333" },
                {
                  enrollments: {
                    some: {
                      userId: "33333333-3333-4333-8333-333333333333",
                      roleInCourse: "teacher",
                      deletedAt: null,
                    },
                  },
                },
              ],
            }),
          }),
        }),
      }),
    );
  });
});
