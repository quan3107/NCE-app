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
import { getIeltsQuestionOptionsHandler } from "./ielts-question-options.controller.js";
import { getIeltsTypeMetadataHandler } from "./ielts-type-metadata.controller.js";

const router = Router();

// GET /api/v1/config/ielts/question-options?type=true_false|yes_no
router.get("/question-options", getIeltsQuestionOptionsHandler);

// GET /api/v1/config/ielts/type-metadata[?version=1]
router.get("/type-metadata", getIeltsTypeMetadataHandler);

// GET /api/v1/config/ielts - Get active config (or specific version via ?version=)
router.get("/", getIeltsConfigHandler);

// GET /api/v1/config/ielts/versions - Get all versions
router.get("/versions", getIeltsConfigVersionsHandler);

export default router;
