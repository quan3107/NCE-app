/**
 * File: src/modules/assignments/generic.schema.ts
 * Purpose: Validate supported generic assignment configs and submission payloads.
 * Why: Generic workflows need type-specific server contracts instead of arbitrary JSON.
 */
import { z } from "zod";

import { AssignmentType } from "../../prisma/index.js";

const genericAssignmentConfigSchema = z
  .object({
    version: z.literal(1),
    maxScore: z.number().finite().positive().max(10_000),
  })
  .strict();

const genericSubmissionBaseSchema = z.object({
  version: z.number().int().positive().optional(),
});

const textSubmissionPayloadSchema = genericSubmissionBaseSchema
  .extend({
    content: z.string().trim().min(1).max(100_000),
  })
  .strict();

const linkSubmissionPayloadSchema = genericSubmissionBaseSchema
  .extend({
    link: z
      .url()
      .max(2_048)
      .refine((value) => {
        const protocol = new URL(value).protocol;
        return protocol === "http:" || protocol === "https:";
      }, "Link must use http or https."),
  })
  .strict();

const fileSubmissionPayloadSchema = genericSubmissionBaseSchema
  .extend({
    files: z
      .array(z.object({ id: z.string().uuid() }).strict())
      .min(1)
      .refine(
        (files) => new Set(files.map((file) => file.id)).size === files.length,
        "File references must be unique.",
      ),
  })
  .strict();

export function parseGenericAssignmentConfig(
  type: AssignmentType,
  config: unknown,
) {
  if (
    type !== AssignmentType.file &&
    type !== AssignmentType.link &&
    type !== AssignmentType.text
  ) {
    return config;
  }

  return genericAssignmentConfigSchema.parse(config);
}

export function parseGenericSubmissionPayload(
  type: AssignmentType,
  payload: unknown,
) {
  if (type === AssignmentType.file) {
    return fileSubmissionPayloadSchema.parse(payload);
  }
  if (type === AssignmentType.link) {
    return linkSubmissionPayloadSchema.parse(payload);
  }
  if (type === AssignmentType.text) {
    return textSubmissionPayloadSchema.parse(payload);
  }

  return payload;
}
