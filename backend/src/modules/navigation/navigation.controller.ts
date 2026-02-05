/**
 * File: src/modules/navigation/navigation.controller.ts
 * Purpose: Handle HTTP requests for navigation endpoints.
 * Why: Separates HTTP handling from business logic.
 */

import type { Request, Response } from "express";

import { getNavigationForRole } from "./navigation.service.js";

export async function getNavigation(
  req: Request,
  res: Response,
): Promise<void> {
  const user = req.user;

  if (!user) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const navigation = await getNavigationForRole(user.role);
  res.status(200).json(navigation);
}
