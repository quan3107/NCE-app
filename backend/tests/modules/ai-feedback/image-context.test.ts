/**
 * File: tests/modules/ai-feedback/image-context.test.ts
 * Purpose: Verify server-side image-context validation before AI provider calls.
 * Why: Keeps IELTS Writing Task 1 visual inputs backend-controlled and provider-safe.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/modules/files/files.service.js", () => ({
  getFileContentLocation: vi.fn(),
}));

const filesService = await import("../../../src/modules/files/files.service.js");
const getFileContentLocation = vi.mocked(filesService.getFileContentLocation);

const { resolveAiFeedbackImageContext } = await import(
  "../../../src/modules/ai-feedback/image-context.js"
);

const actor = {
  id: "11111111-1111-4111-8111-111111111111",
  role: "teacher",
  status: "active",
} as const;

describe("resolveAiFeedbackImageContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns provider-safe image content after backend file access succeeds", async () => {
    getFileContentLocation.mockResolvedValue({
      url: "https://storage.mock/nce/task1-chart.png",
      mime: "image/png",
      size: 1024,
    });

    await expect(
      resolveAiFeedbackImageContext(
        "22222222-2222-4222-8222-222222222222",
        actor,
        {
          supportedMimeTypes: ["image/png", "image/jpeg"],
          maxBytes: 2048,
        },
      ),
    ).resolves.toEqual({
      type: "image",
      imageUrl: "https://storage.mock/nce/task1-chart.png",
      mimeType: "image/png",
      detail: "high",
    });

    expect(getFileContentLocation).toHaveBeenCalledWith(
      "22222222-2222-4222-8222-222222222222",
      actor,
    );
  });

  it("rejects unsupported image MIME types and oversized images", async () => {
    getFileContentLocation.mockResolvedValueOnce({
      url: "https://storage.mock/nce/task1.svg",
      mime: "image/svg+xml",
      size: 1024,
    });

    await expect(
      resolveAiFeedbackImageContext(
        "22222222-2222-4222-8222-222222222222",
        actor,
        {
          supportedMimeTypes: ["image/png"],
          maxBytes: 2048,
        },
      ),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "Unsupported image type for AI feedback.",
    });

    getFileContentLocation.mockResolvedValueOnce({
      url: "https://storage.mock/nce/task1.png",
      mime: "image/png",
      size: 4096,
    });

    await expect(
      resolveAiFeedbackImageContext(
        "22222222-2222-4222-8222-222222222222",
        actor,
        {
          supportedMimeTypes: ["image/png"],
          maxBytes: 2048,
        },
      ),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "Image exceeds the AI feedback image size limit.",
    });
  });
});
