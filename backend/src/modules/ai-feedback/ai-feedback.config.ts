/**
 * File: src/modules/ai-feedback/ai-feedback.config.ts
 * Purpose: Expose AI feedback runtime configuration to the AI feedback module.
 * Why: Keeps future provider wiring behind a module-local import boundary.
 */
import { config } from "../../config/env.js";

export const aiFeedbackConfig = config.aiFeedback;
