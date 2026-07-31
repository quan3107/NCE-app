/**
 * File: tests/modules/me/me.openapi.test.ts
 * Purpose: Lock canonical Unicode profile-name rules in OpenAPI.
 * Why: Documentation and runtime must measure the same submitted representation.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

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
  it("separates normalized request names from canonical profile writes", () => {
    expect(commonSchema).toContain("minLength: 2");
    expect(commonSchema).toContain("maxLength: 100");
    expect(commonSchema).toContain("Unicode code points");
    expect(commonSchema).toContain("PostgreSQL-safe Unicode scalar values");
    expect(commonSchema).toContain("non-printing and bidirectional controls");
    expect(meSchema).toContain("$ref: './common.yaml#/DisplayName'");
    expect(authSchema).toContain(
      "$ref: './common.yaml#/NormalizedDisplayNameInput'",
    );
    expect(
      usersSchema.match(
        /\$ref: '\.\/common\.yaml#\/NormalizedDisplayNameInput'/g,
      ) ?? [],
    ).toHaveLength(2);
    expect(commonSchema).toMatch(
      /NormalizedDisplayNameInput:[\s\S]*trimmed[\s\S]*DisplayName/i,
    );

    const displayNameFragment =
      commonSchema.match(
        /^DisplayName:[\s\S]*?(?=^[A-Za-z][A-Za-z0-9]*:)/m,
      )?.[0] ?? "";
    const documentedPattern = displayNameFragment.match(
      /pattern: '([^']+)'/,
    )?.[1];
    expect(documentedPattern).toBeDefined();
    const fullNamePattern = new RegExp(documentedPattern ?? "", "u");
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
    expect(path).toMatch(
      /get:[\s\S]*'403':[\s\S]*patch:[\s\S]*'403':/,
    );
  });
});
