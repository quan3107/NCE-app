/**
 * File: src/modules/ielts-config/ielts-config.controller.ts
 * Purpose: HTTP handlers for IELTS domain configuration endpoints
 * Why: Handles API requests with Zod validation and specific error messages
 */

import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import {
  getActiveIeltsConfig,
  getIeltsConfigByVersion,
  getIeltsConfigVersions,
} from "./ielts-config.service.js";
import {
  ieltsConfigResponseSchema,
  ieltsConfigVersionsResponseSchema,
} from "../assignments/ielts.schema.js";

// Error response helper
function createErrorResponse(
  code: string,
  message: string,
  details?: Record<string, unknown>,
) {
  return {
    error: {
      code,
      message,
      details: details ?? {},
    },
  };
}

/**
 * GET /api/v1/config/ielts
 * Get active IELTS configuration (or specific version if provided)
 */
export async function getIeltsConfigHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const versionParam = req.query.version;
    let config;

    if (versionParam) {
      // Parse version parameter
      const version = parseInt(versionParam as string, 10);
      if (isNaN(version) || version < 1) {
        res.status(400).json(
          createErrorResponse(
            "IELTS_CONFIG_INVALID_VERSION",
            "Invalid version parameter",
            {
              field: "version",
              received: versionParam,
              hint: "Version must be a positive integer",
            },
          ),
        );
        return;
      }

      config = await getIeltsConfigByVersion(version);

      if (!config) {
        res.status(404).json(
          createErrorResponse(
            "IELTS_CONFIG_VERSION_NOT_FOUND",
            `IELTS configuration version ${version} not found`,
            {
              requestedVersion: version,
              hint: "Use GET /api/v1/config/ielts/versions to see available versions",
            },
          ),
        );
        return;
      }
    } else {
      // Get active configuration
      config = await getActiveIeltsConfig();

      if (!config) {
        res.status(404).json(
          createErrorResponse(
            "IELTS_CONFIG_NOT_FOUND",
            "No active IELTS configuration found",
            {
              hint: "Contact support to initialize IELTS configuration",
            },
          ),
        );
        return;
      }
    }

    // Validate response with Zod
    try {
      const validatedConfig = ieltsConfigResponseSchema.parse(config);
      res.status(200).json(validatedConfig);
    } catch (validationError) {
      if (validationError instanceof z.ZodError) {
        const fieldError = validationError.issues[0];
        res.status(500).json(
          createErrorResponse(
            "IELTS_CONFIG_INVALID_DATA",
            "Invalid IELTS configuration data in database",
            {
              field: fieldError?.path.join("."),
              message: fieldError?.message,
              hint: "Database contains malformed configuration data. Contact support.",
            },
          ),
        );
        return;
      }
      throw validationError;
    }
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/config/ielts/versions
 * Get all IELTS configuration versions
 */
export async function getIeltsConfigVersionsHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { versions, activeVersion } = await getIeltsConfigVersions();

    if (versions.length === 0) {
      res.status(404).json(
        createErrorResponse(
          "IELTS_CONFIG_NOT_FOUND",
          "No IELTS configuration versions found",
          {
            hint: "Contact support to initialize IELTS configuration",
          },
        ),
      );
      return;
    }

    // Validate response with Zod
    try {
      const validatedResponse = ieltsConfigVersionsResponseSchema.parse({
        versions,
        active_version: activeVersion ?? 0,
      });
      res.status(200).json(validatedResponse);
    } catch (validationError) {
      if (validationError instanceof z.ZodError) {
        const fieldError = validationError.issues[0];
        res.status(500).json(
          createErrorResponse(
            "IELTS_CONFIG_INVALID_DATA",
            "Invalid IELTS configuration version data",
            {
              field: fieldError?.path.join("."),
              message: fieldError?.message,
              hint: "Database contains malformed version data. Contact support.",
            },
          ),
        );
        return;
      }
      throw validationError;
    }
  } catch (error) {
    next(error);
  }
}
