/**
 * File: tests/modules/settings/settings.openapi.test.ts
 * Purpose: Lock the role-keyed optimistic settings contract in OpenAPI.
 * Why: Whole-object uniqueness cannot express unique roles with different values.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const schema = readFileSync(
  resolve(process.cwd(), "../docs/openapi/schemas/settings.yaml"),
  "utf8",
);
const path = readFileSync(
  resolve(process.cwd(), "../docs/openapi/paths/settings.yaml"),
  "utf8",
);

describe("settings OpenAPI contract", () => {
  it("models partial updates as unique role properties", () => {
    expect(schema).toContain("FileUploadLimitUpdates:");
    expect(schema).toMatch(/updates:[\s\S]*student:[\s\S]*teacher:[\s\S]*admin:/);
    expect(schema).not.toContain("uniqueItems: true");
    expect(path).toContain(
      "$ref: '../schemas/settings.yaml#/FileUploadLimitUpdates'",
    );
  });

  it("names binary size units as MiB", () => {
    expect(schema).toContain("maxFileSizeMib:");
    expect(schema).toContain("expectedMaxFileSizeMib:");
    expect(schema).not.toContain("maxFileSizeMb");
  });

  it("documents optimistic write conflicts", () => {
    expect(path).toMatch(/'409':\s*\r?\n\s+description: .*conflict/i);
  });

  it("documents runtime failures for reads and writes", () => {
    expect(path.match(/'500':/g)).toHaveLength(2);
    expect(path.match(/common\.yaml#\/ErrorResponse/g)?.length).toBeGreaterThanOrEqual(8);
  });

  it("requires the complete upload-limit role set in responses", () => {
    expect(schema).toMatch(
      /FileUploadLimitsResponse:[\s\S]*minItems:\s*3[\s\S]*maxItems:\s*3/,
    );
    expect(schema).toContain("exactly once");
  });
});
