/**
 * File: src/modules/course-management-tabs/course-management-tabs.schema.ts
 * Purpose: Define validation schemas for backend-driven course management tab config.
 * Why: Keeps endpoint payload contracts explicit and prevents shape drift.
 */

import { z } from "zod";

export const courseManagementTabConfigItemSchema = z.object({
  id: z.string(),
  label: z.string(),
  icon: z.string(),
  required_permission: z.string().nullable(),
  order: z.number().int(),
  enabled: z.boolean(),
});

export const courseManagementTabsResponseSchema = z.object({
  tabs: z.array(courseManagementTabConfigItemSchema),
});

export type CourseManagementTabConfigItem = z.infer<
  typeof courseManagementTabConfigItemSchema
>;

export type CourseManagementTabsResponse = z.infer<
  typeof courseManagementTabsResponseSchema
>;
