/**
 * File: tests/modules/contact/contact.routes.test.ts
 * Purpose: Define the public contact endpoint and abuse-control behavior.
 * Why: Anonymous submissions need a stable response contract without becoming an open spam relay.
 */
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { resetContactRateLimits } from "../../../src/modules/contact/contact.rate-limit.js";
import { createContactSubmission } from "../../../src/modules/contact/contact.service.js";
import { app } from "../../../src/app.js";

vi.mock("../../../src/modules/contact/contact.service.js", () => ({
  createContactSubmission: vi.fn(),
}));

const mockedCreateContactSubmission = vi.mocked(createContactSubmission);
const validPayload = {
  name: "Ada Lovelace",
  email: "ada@example.com",
  subject: "Course access",
  message: "Please help me access my course.",
  website: "",
};

describe("POST /api/v1/contact", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetContactRateLimits();
    mockedCreateContactSubmission.mockResolvedValue({
      id: "11111111-1111-4111-8111-111111111111",
      status: "new",
      submittedAt: "2026-07-27T10:00:00.000Z",
    });
  });

  it("accepts an anonymous submission and passes server-derived metadata", async () => {
    const response = await request(app)
      .post("/api/v1/contact")
      .set("user-agent", "Example Browser")
      .set("referer", "https://example.test/contact")
      .send(validPayload);

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      id: "11111111-1111-4111-8111-111111111111",
      status: "new",
      submittedAt: "2026-07-27T10:00:00.000Z",
    });
    expect(mockedCreateContactSubmission).toHaveBeenCalledWith(
      validPayload,
      expect.objectContaining({
        source: "public-contact",
        ip: expect.any(String),
        userAgent: "Example Browser",
        referrer: "https://example.test/contact",
      }),
    );
  });

  it("returns a generic accepted response for trapped spam", async () => {
    mockedCreateContactSubmission.mockResolvedValueOnce({ accepted: true });

    const response = await request(app)
      .post("/api/v1/contact")
      .send({ ...validPayload, website: "https://spam.example" });

    expect(response.status).toBe(202);
    expect(response.body).toEqual({ accepted: true });
  });

  it("limits repeated submissions from one client", async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await request(app).post("/api/v1/contact").send(validPayload);
      expect(response.status).toBe(201);
    }

    const limitedResponse = await request(app)
      .post("/api/v1/contact")
      .send(validPayload);

    expect(limitedResponse.status).toBe(429);
    expect(limitedResponse.body).toEqual({
      message: "Too many contact submissions. Please try again later.",
    });
    expect(limitedResponse.headers["retry-after"]).toBeDefined();
    expect(mockedCreateContactSubmission).toHaveBeenCalledTimes(5);
  });
});
