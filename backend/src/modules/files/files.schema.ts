/**
 * File: src/modules/files/files.schema.ts
 * Purpose: Validate payloads for file upload signing and completion.
 * Why: Ensures file metadata is consistent before creating storage records.
 */
import { z } from "zod";

export const fileSignSchema = z
  .object({
    fileName: z.string().min(1),
    mime: z.string().min(1),
    size: z.number().int().positive(),
    checksum: z.string().min(1).optional(),
  })
  .strict();

export const fileCompleteSchema = z
  .object({
    bucket: z.string().min(1),
    objectKey: z.string().min(1),
    mime: z.string().min(1),
    size: z.number().int().positive(),
    checksum: z.string().min(1),
  })
  .strict();
