/**
 * File: tests/modules/assignments/assignments.schema.test.ts
 * Purpose: Validate assignment request schema policy shapes.
 * Why: Keeps deadline behavior compatible with supported submission late policies.
 */
import { describe, expect, it } from "vitest";

import {
  createAssignmentSchema,
  updateAssignmentSchema,
} from "../../../src/modules/assignments/assignments.schema.js";

describe("assignments.schema latePolicy", () => {
  it("accepts v1 closed, percent, and per-day late policies", () => {
    expect(() =>
      createAssignmentSchema.parse({
        title: "Writing Task 1",
        type: "writing",
        latePolicy: { type: "closed" },
      }),
    ).not.toThrow();
    expect(() =>
      createAssignmentSchema.parse({
        title: "Reading Practice",
        type: "reading",
        latePolicy: { type: "percent", value: 10 },
      }),
    ).not.toThrow();
    expect(() =>
      updateAssignmentSchema.parse({
        latePolicy: { type: "per_day", value: 5 },
      }),
    ).not.toThrow();
  });

  it("rejects unsupported late policies", () => {
    expect(() =>
      createAssignmentSchema.parse({
        title: "Listening Practice",
        type: "listening",
        latePolicy: { type: "grace_period", hours: 24 },
      }),
    ).toThrow();
  });
});
