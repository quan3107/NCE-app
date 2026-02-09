/**
 * File: src/modules/ielts-config/ielts-type-metadata.controller.ts
 * Purpose: Serve versioned IELTS type-card metadata for assignment type selection UIs.
 * Why: Keeps transport/query validation separate from service fallback logic.
 */

import { type NextFunction, type Request, type Response } from "express";
import { z } from "zod";

import { ieltsTypeMetadataResponseSchema } from "./ielts-type-metadata.schema.js";
import { getIeltsTypeMetadata } from "./ielts-type-metadata.service.js";

const querySchema = z.object({
  version: z.string().optional(),
});

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
 * GET /api/v1/config/ielts/type-metadata[?version=1]
 * Returns IELTS type-card metadata with backend fallback protection.
 */
export async function getIeltsTypeMetadataHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsedQuery = querySchema.safeParse(req.query);

    if (!parsedQuery.success) {
      res.status(400).json(
        createErrorResponse(
          "IELTS_TYPE_METADATA_INVALID_QUERY",
          "Invalid query parameters",
          {
            hint: "Use optional positive integer version",
          },
        ),
      );
      return;
    }

    const { version: versionParam } = parsedQuery.data;
    let version: number | undefined;

    if (versionParam !== undefined) {
      const parsedVersion = parseInt(versionParam, 10);

      if (Number.isNaN(parsedVersion) || parsedVersion < 1) {
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

      version = parsedVersion;
    }

    const payload = await getIeltsTypeMetadata(version);
    const validatedPayload = ieltsTypeMetadataResponseSchema.parse(payload);

    res.status(200).json(validatedPayload);
  } catch (error) {
    next(error);
  }
}
