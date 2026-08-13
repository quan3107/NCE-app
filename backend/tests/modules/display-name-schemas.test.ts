/**
 * File: tests/modules/display-name-schemas.test.ts
 * Purpose: Lock one safe display-name policy across every write entry point.
 * Why: Identity displays must reject invisible and directional control text.
 */
import { describe, expect, it } from "vitest";

import { registerAccountSchema } from "../../src/modules/auth/auth.schema.js";
import { updateMeProfileSchema } from "../../src/modules/me/me.schema.js";
import {
  createUserSchema,
  inviteUserSchema,
} from "../../src/modules/users/users.schema.js";

const validPayloads = [
  [
    "profile",
    updateMeProfileSchema,
    { fullName: "Ada Lovelace", expectedRevision: 0 },
  ],
  [
    "registration",
    registerAccountSchema,
    {
      fullName: "Ada Lovelace",
      email: "ada@example.com",
      password: "password",
      role: "student",
    },
  ],
  [
    "admin creation",
    createUserSchema,
    {
      fullName: "Ada Lovelace",
      email: "ada@example.com",
      role: "student",
      status: "active",
    },
  ],
  [
    "invitation",
    inviteUserSchema,
    {
      fullName: "Ada Lovelace",
      email: "ada@example.com",
      role: "student",
    },
  ],
] as const;

describe("display-name entry points", () => {
  it.each(validPayloads)(
    "%s rejects unsafe display controls",
    (_label, schema, payload) => {
      for (const fullName of [
        "\u200B\u200B",
        "Ada\u200BLovelace",
        "Ada\u202ELovelace",
        "Ada\tLovelace",
        "Ada\nLovelace",
      ]) {
        expect(() => schema.parse({ ...payload, fullName })).toThrow();
      }
    },
  );

  it("normalizes names at registration and admin entry points", () => {
    for (const schema of [
      registerAccountSchema,
      createUserSchema,
      inviteUserSchema,
    ]) {
      expect(
        schema.parse({
          fullName: "  Ada Lovelace  ",
          email: "ada@example.com",
          password: "password",
          role: "student",
          status: "active",
        }).fullName,
      ).toBe("Ada Lovelace");
    }
  });
});
