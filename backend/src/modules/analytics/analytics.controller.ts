/**
 * File: src/modules/analytics/analytics.controller.ts
 * Purpose: Handle analytics HTTP requests for aggregated metrics.
 * Why: Keeps routing thin while delegating aggregation to services.
 */
import { type Request, type Response } from "express";

import { getTeacherAnalytics } from "./analytics.service.js";

export async function getTeacherAnalyticsHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const payload = await getTeacherAnalytics(req.user);
  res.status(200).json(payload);
}
