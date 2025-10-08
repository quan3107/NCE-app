/**
 * File: src/config/logger.ts
 * Purpose: Provide a centralized Pino logger configured from environment settings.
 * Why: Ensures consistent structured logging and prevents ad-hoc console usage across the service.
 */
import pino from "pino";

import { config } from "./env.js";

export const logger = pino({
  level: config.logLevel,
  formatters: {
    level(label, number) {
      return { level: label, levelValue: number };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});
