/**
 * File: tests/modules/contact/contact.validation.routes.test.ts
 * Purpose: Exercise contact validation through the real Express route and service.
 * Why: Invalid honeypot JSON must produce the documented HTTP 400 response.
 */
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { app } from "../../../src/app.js";
import { resetContactRateLimits } from "../../../src/modules/contact/contact.rate-limit.js";
import { prisma as prismaClient } from "../../../src/prisma/client.js";

vi.mock("../../../src/prisma/client.js", () => ({
  prisma: {
    $queryRaw: vi.fn(),
  },
  withRoleContext: vi.fn((_options: unknown, operation: () => void) => operation()),
}));

const prisma = vi.mocked(prismaClient, true);
const validPayload = {
  idempotencyKey: "11111111-1111-4111-8111-111111111111",
  name: "Ada Lovelace",
  email: "ada@example.com",
  subject: "Course access",
  message: "Please help me access my course.",
  website: "",
};

describe("POST /api/v1/contact validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetContactRateLimits();
  });

  it.each([
    ["boolean", false],
    ["object", { value: "spam" }],
    ["array", ["spam"]],
    ["overlong string", "x".repeat(501)],
  ])("returns 400 for a %s honeypot value", async (_case, website) => {
    const response = await request(app)
      .post("/api/v1/contact")
      .send({ ...validPayload, website });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Validation failed.");
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it("retains 202 masking for a valid nonempty honeypot string", async () => {
    const response = await request(app)
      .post("/api/v1/contact")
      .send({ website: "https://spam.example" });

    expect(response.status).toBe(202);
    expect(response.body).toEqual({ accepted: true });
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });
});
