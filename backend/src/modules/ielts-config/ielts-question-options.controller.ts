/**
 * File: src/modules/ielts-config/ielts-question-options.controller.ts
 * Purpose: HTTP handler for IELTS question option values endpoint.
 * Why: Validates query params and returns a stable payload for frontend authoring forms.
 */

import { type NextFunction, type Request, type Response } from "express";
import { z } from "zod";

import { logger } from "../../config/logger.js";
import {
  ieltsQuestionOptionsResponseSchema,
  ieltsQuestionOptionTypeSchema,
} from "./ielts-config.schema.js";
import { getQuestionOptionsForType } from "./ielts-question-options.service.js";

const querySchema = z.object({
  type: ieltsQuestionOptionTypeSchema,
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
 * GET /api/v1/config/ielts/question-options?type=true_false|yes_no[&version=1]
 * Returns enabled option values for boolean-style IELTS question types.
 */
export async function getIeltsQuestionOptionsHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const queryResult = querySchema.safeParse(req.query);

    if (!queryResult.success) {
      res.status(400).json(
        createErrorResponse("IELTS_QUESTION_OPTIONS_INVALID_QUERY", "Invalid query parameters", {
          hint: "Use type=true_false|yes_no and optional positive integer version",
        }),
      );
      return;
    }

    const { type, version: versionParam } = queryResult.data;

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

    const payload = await getQuestionOptionsForType(type, version);

    if (!payload) {
      logger.warn(
        { type, version },
        "IELTS question options requested but not found",
      );
      res.status(404).json(
        createErrorResponse(
          "IELTS_QUESTION_OPTIONS_NOT_FOUND",
          "IELTS question options not found",
          {
            type,
            version: version ?? "active",
            hint: "Ensure IELTS question options exist for the requested config version",
          },
        ),
      );
      return;
    }

    const validatedPayload = ieltsQuestionOptionsResponseSchema.parse(payload);
    res.status(200).json(validatedPayload);
  } catch (error) {
    next(error);
  }
}
