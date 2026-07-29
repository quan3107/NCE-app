/**
 * File: tests/modules/me/me.openapi.test.ts
 * Purpose: Lock canonical Unicode profile-name rules in OpenAPI.
 * Why: Documentation and runtime must measure the same submitted representation.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const schema = readFileSync(
  resolve(process.cwd(), "../docs/openapi/schemas/me.yaml"),
  "utf8",
);
const path = readFileSync(
  resolve(process.cwd(), "../docs/openapi/paths/me.yaml"),
  "utf8",
);

describe("profile OpenAPI contract", () => {
  it("requires a canonical unpadded 2-100 code-point name", () => {
    expect(schema).toContain("minLength: 2");
    expect(schema).toContain("maxLength: 100");
    expect(schema).toContain(
      "pattern: '^(?=\\S(?:[\\s\\S]*\\S)?$)(?:[^\\u0000\\uD800-\\uDFFF]|[\\uD800-\\uDBFF][\\uDC00-\\uDFFF])*$'",
    );
    expect(schema).toContain("Unicode code points");
    expect(schema).toContain("PostgreSQL-safe Unicode scalar values");
    expect(schema).toContain("\\u0000");
    expect(schema).toContain("\\uD800");
    expect(schema).toContain("\\uDFFF");
    expect(schema).not.toContain("after surrounding whitespace is trimmed");

    const documentedPattern = schema.match(/pattern: '([^']+)'/)?.[1];
    expect(documentedPattern).toBeDefined();
    const fullNamePattern = new RegExp(documentedPattern ?? "");
    expect(fullNamePattern.test("Ada 😀 Lovelace")).toBe(true);
    expect(fullNamePattern.test("Ada\u0000Lovelace")).toBe(false);
    expect(fullNamePattern.test("Ada\uD800Lovelace")).toBe(false);
    expect(fullNamePattern.test("Ada\uDC00Lovelace")).toBe(false);
  });

  it("documents guarded 403 responses for GET and PATCH", () => {
    const forbiddenResponses = path.match(/'403':/g) ?? [];
    expect(forbiddenResponses).toHaveLength(2);
    expect(path).toMatch(
      /get:[\s\S]*'403':[\s\S]*patch:[\s\S]*'403':/,
    );
  });
});
