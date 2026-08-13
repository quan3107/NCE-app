/**
 * File: tests/modules/me/me.openapi.test.ts
 * Purpose: Lock presentation-safe response names and canonical write rules in OpenAPI.
 * Why: Upgraded stored names and new writes must share the safe identity contract.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { displayNameSchema } from "../../../src/utils/displayNameValidation.js";

const meSchema = readFileSync(
  resolve(process.cwd(), "../docs/openapi/schemas/me.yaml"),
  "utf8",
);
const commonSchema = readFileSync(
  resolve(process.cwd(), "../docs/openapi/schemas/common.yaml"),
  "utf8",
);
const authSchema = readFileSync(
  resolve(process.cwd(), "../docs/openapi/schemas/auth.yaml"),
  "utf8",
);
const usersSchema = readFileSync(
  resolve(process.cwd(), "../docs/openapi/schemas/users.yaml"),
  "utf8",
);
const path = readFileSync(
  resolve(process.cwd(), "../docs/openapi/paths/me.yaml"),
  "utf8",
);

describe("profile OpenAPI contract", () => {
  it("documents safe persisted responses and canonical profile writes", () => {
    const storedDisplayName =
      commonSchema.match(
        /^DisplayName:[\s\S]*?(?=^[A-Za-z][A-Za-z0-9]*:)/m,
      )?.[0] ?? "";
    const canonicalDisplayName =
      commonSchema.match(
        /^CanonicalDisplayName:[\s\S]*?(?=^[A-Za-z][A-Za-z0-9]*:)/m,
      )?.[0] ?? "";

    expect(storedDisplayName).toContain("minLength: 2");
    expect(storedDisplayName).toContain("maxLength: 100");
    expect(storedDisplayName).toContain(
      "non-printing and bidirectional controls",
    );
    expect(canonicalDisplayName).toContain("minLength: 2");
    expect(canonicalDisplayName).toContain("maxLength: 100");
    expect(canonicalDisplayName).toContain("Unicode code points");
    expect(canonicalDisplayName).toContain(
      "PostgreSQL-safe Unicode scalar values",
    );
    expect(canonicalDisplayName).toContain(
      "non-printing and bidirectional controls",
    );
    expect(meSchema).toMatch(
      /MeProfile:[\s\S]*common\.yaml#\/DisplayName[\s\S]*UpdateMeProfileRequest:[\s\S]*common\.yaml#\/CanonicalDisplayName/,
    );
    expect(meSchema).toMatch(
      /MeProfile:[\s\S]*profileRevision:[\s\S]*required: \[id, email, fullName, role, status, profileRevision\]/,
    );
    expect(meSchema).toMatch(
      /UpdateMeProfileRequest:[\s\S]*expectedRevision:[\s\S]*format: int32[\s\S]*maximum: 2147483647[\s\S]*required: \[fullName\]/,
    );
    expect(meSchema).toMatch(
      /omission is accepted only while[\s\S]*revision is 0/i,
    );
    expect(authSchema).toContain(
      "$ref: './common.yaml#/NormalizedDisplayNameInput'",
    );
    expect(
      usersSchema.match(
        /\$ref: '\.\/common\.yaml#\/NormalizedDisplayNameInput'/g,
      ) ?? [],
    ).toHaveLength(2);
    expect(commonSchema).toMatch(
      /NormalizedDisplayNameInput:[\s\S]*trimmed[\s\S]*CanonicalDisplayName/i,
    );

    const documentedPattern =
      canonicalDisplayName.match(/pattern: '([^']+)'/)?.[1];
    expect(documentedPattern).toBeDefined();
    const fullNamePattern = new RegExp(documentedPattern ?? "");
    expect(fullNamePattern.test("Ada ðŸ˜€ Lovelace")).toBe(true);
    expect(fullNamePattern.test("Ada\u0000Lovelace")).toBe(false);
    expect(fullNamePattern.test("Ada\uD800Lovelace")).toBe(false);
    expect(fullNamePattern.test("Ada\uDC00Lovelace")).toBe(false);
    expect(fullNamePattern.test("\u200B\u200B")).toBe(false);
    expect(fullNamePattern.test("Ada\u202ELovelace")).toBe(false);
    expect(fullNamePattern.test("Ada\tLovelace")).toBe(false);
    expect(fullNamePattern.test("Ada\nLovelace")).toBe(false);
  });

  it("documents guarded 403 responses for GET and PATCH", () => {
    const forbiddenResponses = path.match(/'403':/g) ?? [];
    expect(forbiddenResponses).toHaveLength(2);
    expect(path).toMatch(/get:[\s\S]*'403':[\s\S]*patch:[\s\S]*'403':/);
  });

  it("documents stale profile write conflicts", () => {
    expect(path).toMatch(/patch:[\s\S]*'409':[\s\S]*Profile changed/i);
  });

  it("matches runtime validation for every Unicode scalar", () => {
    const canonicalDisplayName =
      commonSchema.match(
        /^CanonicalDisplayName:[\s\S]*?(?=^[A-Za-z][A-Za-z0-9]*:)/m,
      )?.[0] ?? "";
    const documentedPattern =
      canonicalDisplayName.match(/pattern: '([^']+)'/)?.[1] ?? "";
    const contractPattern = new RegExp(documentedPattern);
    const mismatches: string[] = [];

    for (let codePoint = 0; codePoint <= 0x10ffff; codePoint += 1) {
      if (codePoint >= 0xd800 && codePoint <= 0xdfff) continue;
      const candidate = `A${String.fromCodePoint(codePoint)}A`;
      const runtimeAccepts = displayNameSchema.safeParse(candidate).success;
      const contractAccepts = contractPattern.test(candidate);
      if (runtimeAccepts !== contractAccepts) {
        mismatches.push(`U+${codePoint.toString(16).toUpperCase()}`);
      }
    }

    expect(mismatches).toEqual([]);
  });
});
