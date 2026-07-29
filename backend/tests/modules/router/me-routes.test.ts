/**
 * File: tests/modules/router/me-routes.test.ts
 * Purpose: Verify the authenticated profile update route and validation boundary.
 * Why: Only controlled full-name changes should reach profile persistence.
 */
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/modules/me/me.service.js", () => ({
  getMe: vi.fn(),
  updateMeProfile: vi.fn(),
}));

const meService = await import("../../../src/modules/me/me.service.js");
const { app } = await import("../../../src/app.js");
const updateMeProfile = vi.mocked(meService.updateMeProfile);
const userId = "7f6c9f72-1e95-4f36-8f06-0f0a9ed0b1c2";

const activeStudentHeaders = {
  "x-user-id": userId,
  "x-user-role": "student",
  "x-user-status": "active",
};

describe("modules.router me routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires authentication for PATCH /api/v1/me", async () => {
    const response = await request(app)
      .patch("/api/v1/me")
      .send({ fullName: "Updated Name" });

    expect(response.status).not.toBe(404);
    expect(response.status).toBe(401);
  });

  it("rejects whitespace-only profile names inline", async () => {
    const response = await request(app)
      .patch("/api/v1/me")
      .set(activeStudentHeaders)
      .send({ fullName: "   " });

    expect(response.status).toBe(400);
    expect(updateMeProfile).not.toHaveBeenCalled();
  });

  it("returns the persisted authenticated profile", async () => {
    updateMeProfile.mockResolvedValueOnce({
      id: userId,
      email: "student@example.com",
      fullName: "Updated Name",
      role: "student",
      status: "active",
    });

    const response = await request(app)
      .patch("/api/v1/me")
      .set(activeStudentHeaders)
      .send({ fullName: " Updated Name " });

    expect(response.status).toBe(200);
    expect(updateMeProfile).toHaveBeenCalledWith(userId, {
      fullName: "Updated Name",
    });
    expect(response.body.fullName).toBe("Updated Name");
  });
});
