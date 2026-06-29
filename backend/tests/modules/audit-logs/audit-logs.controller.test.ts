/**
 * File: tests/modules/audit-logs/audit-logs.controller.test.ts
 * Purpose: Verify audit log HTTP query handling.
 * Why: Admin audit filters must reach the service contract intact.
 */
import type { Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../../src/modules/audit-logs/audit-logs.service.js", () => ({
  listAuditLogs: vi.fn(),
}));

const serviceModule = await import(
  "../../../src/modules/audit-logs/audit-logs.service.js"
);
const { getAuditLogs } = await import(
  "../../../src/modules/audit-logs/audit-logs.controller.js"
);
const listAuditLogs = vi.mocked(serviceModule.listAuditLogs);

function request(query: Request["query"]): Request {
  return { query } as Request;
}

function response(): Response {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  } as unknown as Response;
}

describe("audit-logs.controller", () => {
  it("passes admin audit filters and pagination to the service", async () => {
    const payload = { data: [], nextOffset: null };
    listAuditLogs.mockResolvedValueOnce(payload as never);
    const res = response();

    await getAuditLogs(
      request({
        actorId: "7f6c9f72-1e95-4f36-8f06-0f0a9ed0b1c2",
        action: "submission.updated",
        entity: "submission",
        entityId: "6c986d3c-5d72-40d4-96b5-b5e3725c9811",
        createdFrom: "2026-06-01T00:00:00.000Z",
        createdTo: "2026-06-30T23:59:59.000Z",
        limit: "25",
        offset: "50",
      }),
      res,
    );

    expect(listAuditLogs).toHaveBeenCalledWith({
      actorId: "7f6c9f72-1e95-4f36-8f06-0f0a9ed0b1c2",
      action: "submission.updated",
      entity: "submission",
      entityId: "6c986d3c-5d72-40d4-96b5-b5e3725c9811",
      from: new Date("2026-06-01T00:00:00.000Z"),
      to: new Date("2026-06-30T23:59:59.000Z"),
      limit: 25,
      offset: 50,
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(payload);
  });
});
