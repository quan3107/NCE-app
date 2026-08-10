/**
 * File: tests/modules/files/files.schema.test.ts
 * Purpose: Verify upload MIME payloads are meaningful before policy matching.
 * Why: Blank normalized MIME values must never match malformed persisted policy rows.
 */
import { describe, expect, it } from "vitest";

import {
  fileCompleteSchema,
  fileSignSchema,
} from "../../../src/modules/files/files.schema.js";

describe("file upload schemas", () => {
  it.each([
    [fileSignSchema, { fileName: "payload.bin", mime: " \t ", size: 1 }],
    [
      fileCompleteSchema,
      {
        bucket: "uploads",
        objectKey: "payload.bin",
        mime: " \n ",
        size: 1,
        checksum: "checksum",
      },
    ],
  ])("rejects a whitespace-only MIME value", (schema, payload) => {
    expect(schema.safeParse(payload).success).toBe(false);
  });
});
