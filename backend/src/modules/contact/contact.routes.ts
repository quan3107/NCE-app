/**
 * File: src/modules/contact/contact.routes.ts
 * Purpose: Register the anonymous contact submission endpoint.
 * Why: Contact messages need a public, spam-controlled route independent of CMS reads.
 */
import { Router } from "express";

import { postContactSubmission } from "./contact.controller.js";
import { contactRateLimit } from "./contact.rate-limit.js";

export const contactRouter = Router();

contactRouter.post("/", contactRateLimit, postContactSubmission);
