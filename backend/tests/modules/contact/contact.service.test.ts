/**
 * File: tests/modules/contact/contact.service.test.ts
 * Purpose: Define validation and persistence contracts for public contact submissions.
 * Why: Contact messages must be recoverable without trusting client-supplied metadata.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createContactSubmission } from "../../../src/modules/contact/contact.service.js";
import { prisma as prismaClient } from "../../../src/prisma/client.js";
import { Prisma } from "../../../src/prisma/index.js";

vi.mock("../../../src/prisma/client.js", () => ({
  prisma: {
    $queryRaw: vi.fn(),
  },
}));

const prisma = vi.mocked(prismaClient, true);
const idempotencyKey = "11111111-1111-4111-8111-111111111111";
const validPayload = {
  idempotencyKey,
  name: "Ada Lovelace",
  email: "ada@example.com",
  subject: "Course access",
  message: "Please help me access my course.",
  website: "",
};
const requestMetadata = {
  source: "public-contact" as const,
  ip: null,
  userAgent: null,
  referrer: null,
};

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
    [{ idempotencyKey, name: "Ada", email: "a..b@example.com", subject: "Help", message: "A valid message" }],
    [{ idempotencyKey, name: "Ada", email: ".a@example.com", subject: "Help", message: "A valid message" }],
    [{ idempotencyKey, name: "Ada", email: "é@example.com", subject: "Help", message: "A valid message" }],
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

  it.each([
    ["name containing NUL", { name: "Ada\u0000Lovelace" }],
    ["subject containing NUL", { subject: "Course\u0000access" }],
    ["message containing NUL", { message: "Please\u0000 help with access." }],
    ["name containing a lone surrogate", { name: "Ada\uD800Lovelace" }],
    ["subject containing a lone surrogate", { subject: "Course\uDC00access" }],
    ["message containing a lone surrogate", { message: "Please \uD800help with access." }],
  ])("rejects PostgreSQL-unsafe %s", async (_case, override) => {
    await expect(
      createContactSubmission(
        {
          idempotencyKey,
          name: "Ada Lovelace",
          email: "ada@example.com",
          subject: "Course access",
          message: "Please help me access my course.",
          ...override,
        },
        {
          source: "public-contact",
          ip: null,
          userAgent: null,
          referrer: null,
        },
      ),
    ).rejects.toBeDefined();
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it.each([
    ["boolean", false],
    ["object", { value: "spam" }],
    ["array", ["spam"]],
    ["overlong string", "x".repeat(501)],
  ])("rejects a %s honeypot value before spam classification", async (_case, website) => {
    await expect(
      createContactSubmission({ ...validPayload, website }, requestMetadata),
    ).rejects.toBeDefined();
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it.each([
    ["one-code-point name", { name: "😀" }],
    ["two-code-point subject", { subject: "😀😀" }],
    ["nine-code-point message", { message: "😀".repeat(9) }],
    ["121-code-point name", { name: "😀".repeat(121) }],
    ["161-code-point subject", { subject: "😀".repeat(161) }],
    ["5001-code-point message", { message: "😀".repeat(5_001) }],
  ])("rejects an astral %s outside documented character bounds", async (_case, override) => {
    await expect(
      createContactSubmission(
        { ...validPayload, ...override },
        requestMetadata,
      ),
    ).rejects.toBeDefined();
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it("accepts astral text at documented code-point boundaries", async () => {
    await expect(
      createContactSubmission(
        {
          ...validPayload,
          name: "😀".repeat(120),
          subject: "😀".repeat(160),
          message: "😀".repeat(5_000),
        },
        requestMetadata,
      ),
    ).resolves.toEqual({ accepted: true });
    expect(prisma.$queryRaw).toHaveBeenCalledOnce();
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

  it("maps the verified raw-query payload mismatch envelope to an exposed 409", async () => {
    const conflict = new Prisma.PrismaClientKnownRequestError(
      "Raw query failed.",
      {
        code: "P2010",
        clientVersion: "7.9.0",
        meta: {
          driverAdapterError: {
            cause: {
              kind: "postgres",
              originalCode: "23505",
              originalMessage:
                "ERROR: Idempotency key is already bound to a different contact payload.",
            },
          },
        },
      },
    );
    prisma.$queryRaw.mockRejectedValueOnce(conflict);

    await expect(
      createContactSubmission(validPayload, requestMetadata),
    ).rejects.toMatchObject({
      message:
        "Idempotency key is already bound to a different contact payload.",
      statusCode: 409,
      expose: true,
    });
  });

  it("does not translate unrelated raw-query failures", async () => {
    const failure = new Prisma.PrismaClientKnownRequestError(
      "Raw query failed.",
      {
        code: "P2010",
        clientVersion: "7.9.0",
        meta: {
          driverAdapterError: {
            cause: {
              kind: "postgres",
              originalCode: "23505",
              originalMessage: "ERROR: another unique constraint failed.",
            },
          },
        },
      },
    );
    prisma.$queryRaw.mockRejectedValueOnce(failure);

    await expect(
      createContactSubmission(validPayload, requestMetadata),
    ).rejects.toBe(failure);
  });
});
