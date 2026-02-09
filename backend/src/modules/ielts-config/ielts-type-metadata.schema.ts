/**
 * File: src/modules/ielts-config/ielts-type-metadata.schema.ts
 * Purpose: Define validation schemas for IELTS type-card metadata responses.
 * Why: Ensures frontend receives a stable contract for backend-driven card text and themes.
 */

import { z } from "zod";

export const ieltsTypeMetadataThemeSchema = z.object({
  color_from: z.string(),
  color_to: z.string(),
  border_color: z.string(),
});

export const ieltsTypeMetadataItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  icon: z.string(),
  theme: ieltsTypeMetadataThemeSchema,
  enabled: z.boolean(),
  sort_order: z.number().int(),
});

export const ieltsTypeMetadataResponseSchema = z.object({
  version: z.number().int().positive(),
  types: z.array(ieltsTypeMetadataItemSchema),
});

export type IeltsTypeMetadataTheme = z.infer<typeof ieltsTypeMetadataThemeSchema>;
export type IeltsTypeMetadataItem = z.infer<typeof ieltsTypeMetadataItemSchema>;
export type IeltsTypeMetadataResponse = z.infer<typeof ieltsTypeMetadataResponseSchema>;
