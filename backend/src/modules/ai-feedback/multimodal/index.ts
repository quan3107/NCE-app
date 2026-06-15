/**
 * File: src/modules/ai-feedback/multimodal/index.ts
 * Purpose: Define future multimodal transport and visual summary contracts.
 * Why: Later provider-specific image and visual-summary work must preserve the first-release image validation rule.
 */
export type AiHostedImageProvider = "openai-compatible" | "future-provider";

export type AiHostedImageContentPart = {
  type: "provider_hosted_image";
  provider: AiHostedImageProvider;
  imageUrl: string;
  mimeType: string;
  detail?: "auto" | "low" | "high";
};

export type CreateHostedImageContentPartInput = {
  provider: AiHostedImageProvider;
  url: string;
  mimeType: string;
  detail?: "auto" | "low" | "high";
};

export type AiVisualSummaryPipelineInput = {
  source: "teacher_authored" | "derived" | "quality_check";
  assignmentId: string;
  imageContextValidated: boolean;
  summaryMd: string;
};

export function createHostedImageContentPart(
  input: CreateHostedImageContentPartInput,
): AiHostedImageContentPart {
  return {
    type: "provider_hosted_image",
    provider: input.provider,
    imageUrl: input.url,
    mimeType: input.mimeType,
    detail: input.detail,
  };
}
