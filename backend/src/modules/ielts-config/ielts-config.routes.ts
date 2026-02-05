/**
 * File: src/modules/ielts-config/ielts-config.routes.ts
 * Purpose: Route definitions for IELTS domain configuration endpoints
 * Why: Separates routing from controller logic
 */

import { Router } from "express";
import {
  getIeltsConfigHandler,
  getIeltsConfigVersionsHandler,
} from "./ielts-config.controller.js";

const router = Router();

// GET /api/v1/config/ielts - Get active config (or specific version via ?version=)
router.get("/", getIeltsConfigHandler);

// GET /api/v1/config/ielts/versions - Get all versions
router.get("/versions", getIeltsConfigVersionsHandler);

export default router;
