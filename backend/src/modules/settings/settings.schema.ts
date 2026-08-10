/**
 * File: src/modules/settings/settings.schema.ts
 * Purpose: Define admin-managed runtime setting payloads.
 * Why: Role upload limits need bounded units and duplicate-role protection.
 */
import { z } from "zod";

export const uploadLimitRoleSchema = z.enum([
  "student",
  "teacher",
  "admin",
]);

export const fileUploadLimitSchema = z
  .object({
    role: uploadLimitRoleSchema,
    maxFileSizeMib: z.number().int().min(1).max(100),
  })
  .strict();

export const fileUploadLimitsResponseSchema = z
  .object({
    limits: z
      .array(fileUploadLimitSchema)
      .length(3)
      .refine(
        (limits) => new Set(limits.map((limit) => limit.role)).size === 3,
        "Each upload-limit role is required exactly once",
      ),
  })
  .strict();

const uploadLimitUpdateSchema = z
  .object({
    expectedMaxFileSizeMib: z.number().int().min(1).max(100),
    maxFileSizeMib: z.number().int().min(1).max(100),
  })
  .strict();

export const updateFileUploadLimitsSchema = z
  .object({
    updates: z
      .object({
        student: uploadLimitUpdateSchema.optional(),
        teacher: uploadLimitUpdateSchema.optional(),
        admin: uploadLimitUpdateSchema.optional(),
      })
      .strict(),
  })
  .strict()
  .refine((value) => Object.keys(value.updates).length > 0, {
    message: "At least one role update is required",
    path: ["updates"],
  });

export type UploadLimitRole = z.infer<typeof uploadLimitRoleSchema>;
export type FileUploadLimitsPayload = z.infer<
  typeof fileUploadLimitsResponseSchema
>;
export type UpdateFileUploadLimitsPayload = z.infer<
  typeof updateFileUploadLimitsSchema
>;
