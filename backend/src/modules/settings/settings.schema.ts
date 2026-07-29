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
    maxFileSizeMb: z.number().int().min(1).max(100),
  })
  .strict();

export const fileUploadLimitsResponseSchema = z
  .object({
    limits: z.array(fileUploadLimitSchema).min(1).max(3),
  })
  .strict();

export const updateFileUploadLimitsSchema =
  fileUploadLimitsResponseSchema.superRefine((value, context) => {
    const roles = value.limits.map((limit) => limit.role);
    if (new Set(roles).size !== roles.length) {
      context.addIssue({
        code: "custom",
        message: "Each role can appear only once",
        path: ["limits"],
      });
    }
  });

export type UploadLimitRole = z.infer<typeof uploadLimitRoleSchema>;
export type FileUploadLimitsPayload = z.infer<
  typeof fileUploadLimitsResponseSchema
>;
