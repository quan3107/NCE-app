/**
 * File: tests/modules/settings/settings.schema.test.ts
 * Purpose: Lock the partial, role-keyed upload-limit update contract.
 * Why: A role must appear at most once and every write must carry its expected value.
 */
import { describe, expect, it } from "vitest";

import {
  fileUploadLimitsResponseSchema,
  updateFileUploadLimitsSchema,
} from "../../../src/modules/settings/settings.schema.js";

describe("updateFileUploadLimitsSchema", () => {
  it("accepts a partial role-keyed update with an expected value", () => {
    expect(
      updateFileUploadLimitsSchema.parse({
        updates: {
          teacher: {
            expectedMaxFileSizeMb: 25,
            maxFileSizeMb: 30,
          },
        },
      }),
    ).toEqual({
      updates: {
        teacher: {
          expectedMaxFileSizeMb: 25,
          maxFileSizeMb: 30,
        },
      },
    });
  });

  it("rejects the legacy array shape that permits duplicate role objects", () => {
    expect(() =>
      updateFileUploadLimitsSchema.parse({
        limits: [
          { role: "student", maxFileSizeMb: 10 },
          { role: "student", maxFileSizeMb: 20 },
        ],
      }),
    ).toThrow();
  });

  it("requires at least one role update", () => {
    expect(() =>
      updateFileUploadLimitsSchema.parse({
        updates: {},
      }),
    ).toThrow();
  });

  it("requires one response row for every unique upload-limit role", () => {
    expect(() =>
      fileUploadLimitsResponseSchema.parse({
        limits: [
          { role: "student", maxFileSizeMb: 10 },
          { role: "teacher", maxFileSizeMb: 20 },
        ],
      }),
    ).toThrow();
    expect(() =>
      fileUploadLimitsResponseSchema.parse({
        limits: [
          { role: "student", maxFileSizeMb: 10 },
          { role: "student", maxFileSizeMb: 20 },
          { role: "admin", maxFileSizeMb: 30 },
        ],
      }),
    ).toThrow();
  });
});
