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

describe("profile OpenAPI contract", () => {
  it("requires a canonical unpadded 2-100 code-point name", () => {
    expect(schema).toContain("minLength: 2");
    expect(schema).toContain("maxLength: 100");
    expect(schema).toContain("pattern: '^\\S(?:[\\s\\S]*\\S)?$'");
    expect(schema).toContain("Unicode code points");
    expect(schema).not.toContain("after surrounding whitespace is trimmed");
  });
});
