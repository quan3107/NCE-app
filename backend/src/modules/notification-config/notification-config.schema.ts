/**
 * File: src/modules/notification-config/notification-config.schema.ts
 * Purpose: Define validation schemas for notification type configuration responses.
 * Why: Keeps payload contracts explicit and prevents shape drift at API boundaries.
 */

import { z } from "zod";

export const notificationTypeConfigItemSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string(),
  category: z.string(),
  icon: z.string().optional(),
  accent: z.string().optional(),
  default_enabled: z.boolean(),
  enabled: z.boolean(),
  sort_order: z.number().int(),
});

export const notificationTypesResponseSchema = z.object({
  types: z.array(notificationTypeConfigItemSchema),
});

export type NotificationTypeConfigItem = z.infer<
  typeof notificationTypeConfigItemSchema
>;
export type NotificationTypesResponse = z.infer<
  typeof notificationTypesResponseSchema
>;
