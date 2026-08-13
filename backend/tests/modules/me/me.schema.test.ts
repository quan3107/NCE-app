/**
 * File: tests/modules/me/me.schema.test.ts
 * Purpose: Lock canonical Unicode-aware profile-name validation.
 * Why: Runtime validation and OpenAPI must count the same submitted characters.
 */
import { describe, expect, it } from "vitest";

import { updateMeProfileSchema } from "../../../src/modules/me/me.schema.js";

describe("updateMeProfileSchema", () => {
  it("requires a nonnegative expected profile revision", () => {
    expect(
      updateMeProfileSchema.parse({
        fullName: "Ada Lovelace",
        expectedRevision: 3,
      }),
    ).toEqual({ fullName: "Ada Lovelace", expectedRevision: 3 });
    expect(() =>
      updateMeProfileSchema.parse({ fullName: "Ada Lovelace" }),
    ).toThrow();
  });

  it.each([
    ["two code points", "😀😀"],
    ["one hundred code points", "😀".repeat(100)],
    ["interior whitespace", "Ada Lovelace"],
  ])("accepts %s", (_label, fullName) => {
    expect(
      updateMeProfileSchema.parse({ fullName, expectedRevision: 0 }),
    ).toEqual({
      fullName,
      expectedRevision: 0,
    });
  });

  it.each([
    ["one code point", "😀"],
    ["one hundred and one code points", "😀".repeat(101)],
    ["leading whitespace", " Ada"],
    ["trailing whitespace", "Ada "],
    ["NUL", "Ada\u0000Lovelace"],
    ["unpaired high surrogate", "Ada\uD800Lovelace"],
    ["unpaired low surrogate", "Ada\uDC00Lovelace"],
    ["zero-width space", "Ada\u200BLovelace"],
    ["bidirectional override", "Ada\u202ELovelace"],
    ["tab", "Ada\tLovelace"],
    ["newline", "Ada\nLovelace"],
  ])("rejects %s", (_label, fullName) => {
    expect(() =>
      updateMeProfileSchema.parse({ fullName, expectedRevision: 0 }),
    ).toThrow();
  });
});
