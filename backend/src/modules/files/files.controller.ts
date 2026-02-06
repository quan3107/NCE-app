/**
 * File: src/modules/files/files.controller.ts
 * Purpose: Handle HTTP requests for file signing and completion.
 * Why: Keeps file workflow HTTP plumbing separate from storage logic.
 */
import { type Request, type Response } from "express";

import { completeFileUpload, signFileUpload } from "./files.service.js";

export async function postFileSign(
  req: Request,
  res: Response,
): Promise<void> {
  const actor = req.user;

  if (!actor) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const signedPayload = await signFileUpload(req.body, actor.id, actor.role);
  res.status(200).json(signedPayload);
}

export async function postFileComplete(
  req: Request,
  res: Response,
): Promise<void> {
  const actor = req.user;

  if (!actor) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const file = await completeFileUpload(req.body, actor.id, actor.role);
  res.status(201).json(file);
}
