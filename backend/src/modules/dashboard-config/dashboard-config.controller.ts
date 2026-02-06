/**
 * File: src/modules/dashboard-config/dashboard-config.controller.ts
 * Purpose: Handle dashboard widget config HTTP requests for defaults and personalization.
 * Why: Keeps request parsing and auth checks separate from service-layer merge logic.
 */

import type { Request, Response } from "express";

import {
  dashboardWidgetDefaultsResponseSchema,
  myDashboardConfigResponseSchema,
  updateMyDashboardConfigRequestSchema,
} from "./dashboard-config.schema.js";
import {
  getDashboardWidgetDefaultsForRole,
  getMyDashboardConfigForUser,
  resetMyDashboardConfigForUser,
  saveMyDashboardConfigForUser,
} from "./dashboard-config.service.js";

export async function getDashboardWidgetDefaults(
  req: Request,
  res: Response,
): Promise<void> {
  const user = req.user;

  if (!user) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const payload = await getDashboardWidgetDefaultsForRole(user.role);
  res.status(200).json(dashboardWidgetDefaultsResponseSchema.parse(payload));
}

export async function getMyDashboardConfig(
  req: Request,
  res: Response,
): Promise<void> {
  const user = req.user;

  if (!user) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const payload = await getMyDashboardConfigForUser(user.id, user.role);
  res.status(200).json(myDashboardConfigResponseSchema.parse(payload));
}

export async function putMyDashboardConfig(
  req: Request,
  res: Response,
): Promise<void> {
  const user = req.user;

  if (!user) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const body = updateMyDashboardConfigRequestSchema.parse(req.body);
  const payload = await saveMyDashboardConfigForUser(user.id, user.role, body);

  res.status(200).json(myDashboardConfigResponseSchema.parse(payload));
}

export async function deleteMyDashboardConfig(
  req: Request,
  res: Response,
): Promise<void> {
  const user = req.user;

  if (!user) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  await resetMyDashboardConfigForUser(user.id, user.role);
  res.status(204).send();
}
