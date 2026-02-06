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
});
