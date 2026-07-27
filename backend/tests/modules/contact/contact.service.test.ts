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
    contactSubmission: {
      create: vi.fn(),
    },
  },
}));

const prisma = vi.mocked(prismaClient, true);


describe("contact.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.contactSubmission.create.mockResolvedValue({
      id: "11111111-1111-4111-8111-111111111111",
      status: "new",
      createdAt: new Date("2026-07-27T10:00:00.000Z"),
    });
  });

  it("normalizes and persists a recoverable contact submission", async () => {
    await expect(
      createContactSubmission(
        {
          name: "  Ada Lovelace  ",
          email: " ADA@EXAMPLE.COM ",
          subject: "  Course access  ",
          message: "  Please help me access my course.  ",
          website: "",
        },
        {
          source: "public-contact",
          ip: "203.0.113.10",
          userAgent: "Example Browser",
          referrer: "https://example.test/about",
        },
      ),
    ).resolves.toEqual({
      id: "11111111-1111-4111-8111-111111111111",
      status: "new",
      submittedAt: "2026-07-27T10:00:00.000Z",
    });

    expect(prisma.contactSubmission.create).toHaveBeenCalledWith({
      data: {
        name: "Ada Lovelace",
        email: "ada@example.com",
        subject: "Course access",
        message: "Please help me access my course.",
        source: "public-contact",
        status: "new",
        metadata: {
          ip: "203.0.113.10",
          userAgent: "Example Browser",
          referrer: "https://example.test/about",
        },
      },
      select: { id: true, status: true, createdAt: true },
    });
  });

  it.each([
    [{ name: "A", email: "ada@example.com", subject: "Help", message: "A valid message" }],
    [{ name: "Ada", email: "not-an-email", subject: "Help", message: "A valid message" }],
    [{ name: "Ada", email: "ada@example.com", subject: "Hi", message: "short" }],
    [{ name: "Ada", email: "ada@example.com", subject: "Help", message: "A valid message", extra: true }],
  ])("rejects invalid public payload %#", async (payload) => {
    await expect(
      createContactSubmission(payload, {
        source: "public-contact",
        ip: null,
        userAgent: null,
        referrer: null,
      }),
    ).rejects.toBeDefined();
    expect(prisma.contactSubmission.create).not.toHaveBeenCalled();
  });

  it("silently routes honeypot submissions without persistence", async () => {
    await expect(
      createContactSubmission(
        {
          name: "Ada Lovelace",
          email: "ada@example.com",
          subject: "Course access",
          message: "Please help me access my course.",
          website: "https://spam.example",
        },
        {
          source: "public-contact",
          ip: "203.0.113.10",
          userAgent: null,
          referrer: null,
        },
      ),
    ).resolves.toEqual({ accepted: true });
    expect(prisma.contactSubmission.create).not.toHaveBeenCalled();
  });
});
