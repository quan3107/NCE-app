/**
 * File: src/modules/notification-preferences/notification-preferences.schema.ts
 * Purpose: Define request and response schemas for per-user notification preference APIs.
 * Why: Keeps notification preference contracts explicit and validated at the API boundary.
 */

import { z } from "zod";

const roleSchema = z.enum(["student", "teacher", "admin"]);

export const notificationPreferenceTypeSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
    description: z.string(),
    category: z.string().min(1),
    default_enabled: z.boolean(),
    enabled: z.boolean(),
    sort_order: z.number().int().nonnegative(),
  })
  .strict();

export const myNotificationPreferencesResponseSchema = z
  .object({
    role: roleSchema,
    version: z.string().min(1),
    personalized: z.boolean(),
    types: z.array(notificationPreferenceTypeSchema),
  })
  .strict();

const notificationPreferenceUpdateSchema = z
  .object({
    id: z.string().min(1),
    enabled: z.boolean(),
  })
  .strict();

export const updateMyNotificationPreferencesRequestSchema = z
  .object({
    types: z.array(notificationPreferenceUpdateSchema).min(1),
  })
  .strict();

export type MyNotificationPreferencesResponse = z.infer<
  typeof myNotificationPreferencesResponseSchema
>;
export type UpdateMyNotificationPreferencesRequest = z.infer<
  typeof updateMyNotificationPreferencesRequestSchema
>;
