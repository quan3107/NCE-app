/**
 * File: src/modules/me/me.controller.ts
 * Purpose: Serve the authenticated user's profile endpoint.
 * Why: Keeps /me HTTP handling separate from data access logic.
 */
import { type Request, type Response } from "express";

import { getMe as fetchMe } from "./me.service.js";

export async function getMe(
  req: Request,
  res: Response,
): Promise<void> {
  const actor = req.user;

  if (!actor) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const me = await fetchMe(actor.id);
  res.status(200).json(me);
}
