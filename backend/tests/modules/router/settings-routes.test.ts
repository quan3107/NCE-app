/**
 * File: tests/modules/router/settings-routes.test.ts
 * Purpose: Verify runtime settings routes are mounted and admin protected.
 * Why: Upload policy changes must not be exposed to ordinary authenticated users.
 */
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/modules/settings/settings.service.js", () => ({
  getFileUploadLimits: vi.fn(),
  updateFileUploadLimits: vi.fn(),
}));

const settingsService = await import(
  "../../../src/modules/settings/settings.service.js"
);
const { app } = await import("../../../src/app.js");
const updateFileUploadLimits = vi.mocked(
  settingsService.updateFileUploadLimits,
);
const userId = "7f6c9f72-1e95-4f36-8f06-0f0a9ed0b1c2";

const headersFor = (role: "admin" | "teacher") => ({
  "x-user-id": userId,
  "x-user-role": role,
  "x-user-status": "active",
});

describe("modules.router settings routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires admin access for upload-limit settings", async () => {
    const anonymous = await request(app).get(
      "/api/v1/settings/file-upload-limits",
    );
    const teacher = await request(app)
      .get("/api/v1/settings/file-upload-limits")
      .set(headersFor("teacher"));

    expect(anonymous.status).not.toBe(404);
    expect(anonymous.status).toBe(401);
    expect(teacher.status).toBe(403);
  });

  it("rejects out-of-range settings before persistence", async () => {
    const response = await request(app)
      .patch("/api/v1/settings/file-upload-limits")
      .set(headersFor("admin"))
      .send({
        updates: {
          student: {
            expectedMaxFileSizeMib: 10,
            maxFileSizeMib: 0,
          },
        },
      });

    expect(response.status).toBe(400);
    expect(updateFileUploadLimits).not.toHaveBeenCalled();
  });

  it("persists validated admin settings", async () => {
    const requestPayload = {
      updates: {
        student: {
          expectedMaxFileSizeMib: 10,
          maxFileSizeMib: 12,
        },
      },
    };
    const responsePayload = {
      limits: [
        { role: "student" as const, maxFileSizeMib: 12 },
        { role: "teacher" as const, maxFileSizeMib: 25 },
        { role: "admin" as const, maxFileSizeMib: 50 },
      ],
    };
    updateFileUploadLimits.mockResolvedValueOnce(responsePayload);

    const response = await request(app)
      .patch("/api/v1/settings/file-upload-limits")
      .set(headersFor("admin"))
      .send(requestPayload);

    expect(response.status).toBe(200);
    expect(updateFileUploadLimits).toHaveBeenCalledWith(requestPayload, userId);
    expect(response.body).toEqual(responsePayload);
  });
});
