/**
 * File: src/modules/file-upload-config/file-upload-config.schema.ts
 * Purpose: Define response schemas for file upload configuration endpoints.
 * Why: Keeps API payload contracts explicit and validated before responding.
 */

import { z } from "zod";

export const fileUploadLimitsSchema = z
  .object({
    max_file_size: z.number().int().positive(),
    max_total_size: z.number().int().positive(),
    max_files_per_upload: z.number().int().positive(),
  })
  .strict();

export const fileUploadLimitsResponseSchema = z
  .object({
    limits: fileUploadLimitsSchema,
  })
  .strict();

export const fileUploadAllowedTypeSchema = z
  .object({
    mime_type: z.string().min(1),
    extensions: z.array(z.string().min(2)),
    label: z.string().min(1),
    accept_token: z.string().min(1),
  })
  .strict();

export const allowedFileTypesResponseSchema = z
  .object({
    allowed_types: z.array(fileUploadAllowedTypeSchema),
    accept: z.string().min(1),
    type_label: z.string().min(1),
  })
  .strict();

export type FileUploadLimitsResponse = z.infer<typeof fileUploadLimitsResponseSchema>;
export type AllowedFileTypesResponse = z.infer<typeof allowedFileTypesResponseSchema>;
