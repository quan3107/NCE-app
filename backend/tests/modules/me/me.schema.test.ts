/**
 * File: tests/modules/me/me.schema.test.ts
 * Purpose: Lock canonical Unicode-aware profile-name validation.
 * Why: Runtime validation and OpenAPI must count the same submitted characters.
 */
import { describe, expect, it } from "vitest";

import { updateMeProfileSchema } from "../../../src/modules/me/me.schema.js";

describe("updateMeProfileSchema", () => {
  it.each([
    ["two code points", "😀😀"],
    ["one hundred code points", "😀".repeat(100)],
    ["interior whitespace", "Ada Lovelace"],
  ])("accepts %s", (_label, fullName) => {
    expect(updateMeProfileSchema.parse({ fullName })).toEqual({ fullName });
  });

  it.each([
    ["one code point", "😀"],
    ["one hundred and one code points", "😀".repeat(101)],
    ["leading whitespace", " Ada"],
    ["trailing whitespace", "Ada "],
  ])("rejects %s", (_label, fullName) => {
    expect(() => updateMeProfileSchema.parse({ fullName })).toThrow();
  });
});
