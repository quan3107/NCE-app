/**
 * File: src/modules/files/files.schema.ts
 * Purpose: Validate payloads for file upload signing and completion.
 * Why: Ensures file metadata is consistent before creating storage records.
 */
import { z } from "zod";

export const fileSignSchema = z
  .object({
    fileName: z.string().min(1),
    mime: z.string().trim().min(1),
    size: z.number().int().positive(),
    checksum: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();

export const fileCompleteSchema = z
  .object({
    bucket: z.string().min(1),
    objectKey: z.string().min(1),
    mime: z.string().trim().min(1),
    size: z.number().int().positive(),
    checksum: z.string().regex(/^[a-f0-9]{64}$/),
    uploadToken: z.string().min(1).max(4096),
  })
  .strict();

export const fileIdParamsSchema = z
  .object({
    id: z.string().uuid(),
  })
  .strict();
