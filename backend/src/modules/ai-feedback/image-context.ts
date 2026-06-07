/**
 * File: src/modules/ai-feedback/image-context.ts
 * Purpose: Validate backend-controlled image context before AI provider requests.
 * Why: Lets IELTS Writing Task 1 use hosted image input without exposing storage handles to browser clients.
 */
import type { RequestActor } from "../../middleware/requestActor.js";
import { createHttpError } from "../../utils/httpError.js";
import { aiFeedbackConfig } from "./ai-feedback.config.js";
import type { AiProviderImageContentPart } from "./provider.types.js";
import { getFileContentLocation } from "../files/files.service.js";

type ImageContextOptions = {
  supportedMimeTypes?: string[];
  maxBytes?: number;
};

function normalizeMime(value: string): string {
  return value.trim().toLowerCase();
}

export async function resolveAiFeedbackImageContext(
  fileId: string,
  actor: RequestActor,
  options: ImageContextOptions = {},
): Promise<AiProviderImageContentPart> {
  const content = await getFileContentLocation(fileId, actor);
  const supportedMimeTypes = new Set(
    (options.supportedMimeTypes ?? aiFeedbackConfig.imageInput.supportedMimeTypes).map(
      normalizeMime,
    ),
  );
  const mimeType = normalizeMime(content.mime);
  const maxBytes = options.maxBytes ?? aiFeedbackConfig.imageInput.maxBytes;

  if (!supportedMimeTypes.has(mimeType)) {
    throw createHttpError(400, "Unsupported image type for AI feedback.", {
      mime: mimeType,
      supported_mime_types: Array.from(supportedMimeTypes),
    });
  }

  if (content.size > maxBytes) {
    throw createHttpError(400, "Image exceeds the AI feedback image size limit.", {
      size: content.size,
      max_bytes: maxBytes,
    });
  }

  return {
    type: "image",
    imageUrl: content.url,
    mimeType,
    detail: "high",
  };
}
