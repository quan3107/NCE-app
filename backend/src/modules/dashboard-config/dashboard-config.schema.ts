/**
 * File: src/modules/dashboard-config/dashboard-config.schema.ts
 * Purpose: Define request and response schemas for dashboard widget configuration endpoints.
 * Why: Keeps payload contracts explicit and validated across config and personalization APIs.
 */

import { z } from "zod";

const roleSchema = z.enum(["student", "teacher", "admin"]);

const widgetPositionSchema = z
  .object({
    x: z.number().int().nonnegative(),
    y: z.number().int().nonnegative(),
    w: z.number().int().positive(),
    h: z.number().int().positive(),
  })
  .strict();

const dashboardWidgetDefaultSchema = z
  .object({
    id: z.string().min(1),
    type: z.string().min(1),
    label: z.string().min(1),
    icon_name: z.string().min(1),
    color: z.string().min(1),
    data_source: z.string().min(1),
    value_format: z.string().min(1),
    default_order: z.number().int().nonnegative(),
    default_visible: z.boolean(),
    position: widgetPositionSchema,
  })
  .strict();

export const dashboardWidgetDefaultsResponseSchema = z
  .object({
    role: roleSchema,
    version: z.string().min(1),
    widgets: z.array(dashboardWidgetDefaultSchema),
  })
  .strict();

const dashboardWidgetEffectiveSchema = z
  .object({
    id: z.string().min(1),
    type: z.string().min(1),
    label: z.string().min(1),
    icon_name: z.string().min(1),
    color: z.string().min(1),
    data_source: z.string().min(1),
    value_format: z.string().min(1),
    visible: z.boolean(),
    order: z.number().int().nonnegative(),
    position: widgetPositionSchema,
  })
  .strict();

export const myDashboardConfigResponseSchema = z
  .object({
    role: roleSchema,
    version: z.string().min(1),
    personalized: z.boolean(),
    widgets: z.array(dashboardWidgetEffectiveSchema),
  })
  .strict();

const dashboardWidgetPreferenceInputSchema = z
  .object({
    id: z.string().min(1),
    visible: z.boolean(),
    order: z.number().int().nonnegative(),
    position: widgetPositionSchema,
  })
  .strict();

export const updateMyDashboardConfigRequestSchema = z
  .object({
    widgets: z.array(dashboardWidgetPreferenceInputSchema).min(1),
  })
  .strict();

export type DashboardWidgetDefaultsResponse = z.infer<
  typeof dashboardWidgetDefaultsResponseSchema
>;
export type MyDashboardConfigResponse = z.infer<
  typeof myDashboardConfigResponseSchema
>;
export type UpdateMyDashboardConfigRequest = z.infer<
  typeof updateMyDashboardConfigRequestSchema
>;
