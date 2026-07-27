/**
 * File: src/modules/contact/contact.controller.ts
 * Purpose: Translate public contact requests into persisted submissions.
 * Why: Keeps request metadata server-derived and HTTP status handling out of the service.
 */
import type { Request, Response } from "express";

import { createContactSubmission } from "./contact.service.js";

const clampHeader = (value: string | undefined): string | null =>
  value ? value.slice(0, 500) : null;

export async function postContactSubmission(
  req: Request,
  res: Response,
): Promise<void> {
  const result = await createContactSubmission(req.body, {
    source: "public-contact",
    ip: req.ip || req.socket.remoteAddress || null,
    userAgent: clampHeader(req.get("user-agent")),
    referrer: clampHeader(req.get("referer")),
  });

  res.status("accepted" in result ? 202 : 201).json(result);
}
