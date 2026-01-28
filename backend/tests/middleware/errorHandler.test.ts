/**
 * File: tests/middleware/errorHandler.test.ts
 * Purpose: Validate error responses for schema validation failures.
 * Why: Ensures 400 responses include field errors for invalid payloads.
 */
import type { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { describe, expect, it, vi } from "vitest";

import { errorHandler } from "../../src/middleware/errorHandler.js";

describe("middleware.errorHandler", () => {
  it("returns 400 with field errors for Zod validation failures", () => {
    const schema = z.object({ title: z.string().min(1) });
    let capturedError: unknown;

    try {
      schema.parse({});
    } catch (error) {
      capturedError = error;
    }

    if (!capturedError) {
      throw new Error("Expected schema.parse to throw a ZodError.");
    }

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as Response;

    errorHandler(
      capturedError as Error,
      {} as Request,
      res,
      vi.fn() as NextFunction,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Validation failed.",
        details: expect.objectContaining({
          fieldErrors: expect.any(Object),
        }),
      }),
    );
  });
});
