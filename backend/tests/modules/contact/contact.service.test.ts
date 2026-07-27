/**
 * File: tests/modules/contact/contact.service.test.ts
 * Purpose: Define validation and persistence contracts for public contact submissions.
 * Why: Contact messages must be recoverable without trusting client-supplied metadata.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createContactSubmission } from "../../../src/modules/contact/contact.service.js";
import { prisma as prismaClient } from "../../../src/prisma/client.js";

vi.mock("../../../src/prisma/client.js", () => ({
  prisma: {
    $queryRaw: vi.fn(),
  },
}));

const prisma = vi.mocked(prismaClient, true);
const idempotencyKey = "11111111-1111-4111-8111-111111111111";

describe("contact.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.$queryRaw.mockResolvedValue([{ submit_contact_message: null }]);
  });

  it("persists canonical values through the narrow idempotent database function", async () => {
    await expect(
      createContactSubmission(
        {
          idempotencyKey,
          name: "Ada Lovelace",
          email: "ada@example.com",
          subject: "Course access",
          message: "Please help me access my course.",
          website: "",
        },
        {
          source: "public-contact",
          ip: "203.0.113.10",
          userAgent: "Example Browser",
          referrer: "https://example.test/about",
        },
      ),
    ).resolves.toEqual({ accepted: true });

    expect(prisma.$queryRaw).toHaveBeenCalledOnce();
    const query = prisma.$queryRaw.mock.calls[0]?.[0] as {
      sql?: string;
      values?: unknown[];
    };
    expect(query.sql).toContain("app.submit_contact_message");
    expect(query.sql).toMatch(/submit_contact_message\([\s\S]*\)::text/);
    expect(query.values).toEqual([
      idempotencyKey,
      "Ada Lovelace",
      "ada@example.com",
      "Course access",
      "Please help me access my course.",
      "public-contact",
      JSON.stringify({
        ip: "203.0.113.10",
        userAgent: "Example Browser",
        referrer: "https://example.test/about",
      }),
    ]);
  });

  it.each([
    [{ idempotencyKey, name: "A", email: "ada@example.com", subject: "Help", message: "A valid message" }],
    [{ idempotencyKey, name: " Ada ", email: "ada@example.com", subject: "Help", message: "A valid message" }],
    [{ idempotencyKey, name: "Ada", email: "not-an-email", subject: "Help", message: "A valid message" }],
    [{ idempotencyKey, name: "Ada", email: "ada@example.com", subject: "Hi", message: "short" }],
    [{ idempotencyKey: "not-a-uuid", name: "Ada", email: "ada@example.com", subject: "Help", message: "A valid message" }],
    [{ idempotencyKey, name: "Ada", email: "ada@example.com", subject: "Help", message: "A valid message", extra: true }],
  ])("rejects invalid public payload %#", async (payload) => {
    await expect(
      createContactSubmission(payload, {
        source: "public-contact",
        ip: null,
        userAgent: null,
        referrer: null,
      }),
    ).rejects.toBeDefined();
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it("routes malformed honeypot submissions before validating normal fields", async () => {
    await expect(
      createContactSubmission(
        { website: "https://spam.example" },
        {
          source: "public-contact",
          ip: "203.0.113.10",
          userAgent: null,
          referrer: null,
        },
      ),
    ).resolves.toEqual({ accepted: true });
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });
});
