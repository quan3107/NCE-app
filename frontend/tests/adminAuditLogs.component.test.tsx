/**
 * Location: tests/adminAuditLogs.component.test.tsx
 * Purpose: Verify audit target identifiers are visible in the admin table.
 * Why: Entity type alone cannot distinguish marker-only events for different records.
 */
import assert from "node:assert/strict";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, test, vi } from "vitest";

import { AdminAuditLogsPage } from "../src/features/admin/components/AdminAuditLogsPage";

vi.mock("@features/admin/api", () => ({
  AUDIT_LOG_PAGE_SIZE: 50,
  useAdminAuditLogsQuery: (offset = 0) => ({
    data: {
      nextOffset: offset === 0 ? 50 : null,
      data: [
        {
          id: "audit-1",
          actor: "System",
          action: "course.updated",
          entity: "course",
          entityId: offset === 0 ? "course-17" : "course-18",
          eventData: { titleChanged: true },
          schemaVersion: 1,
          timestamp: new Date("2026-07-25T12:00:00.000Z"),
          details: '{"titleChanged":true}',
        },
      ],
    },
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

afterEach(cleanup);

test("admin audit table displays entityId", () => {
  render(
    <MemoryRouter>
      <AdminAuditLogsPage />
    </MemoryRouter>,
  );

  assert.ok(screen.getByRole("columnheader", { name: "Entity ID" }));
  assert.ok(screen.getByText("course-17"));
  assert.equal(
    (screen.getByRole("button", { name: "Previous" }) as HTMLButtonElement)
      .disabled,
    true,
  );
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  assert.ok(screen.getByText("course-18"));
  assert.equal(screen.queryByText("course-17") === null, true);
  assert.ok(screen.getByText("Page 2"));
  assert.equal(
    (screen.getByRole("button", { name: "Next" }) as HTMLButtonElement)
      .disabled,
    true,
  );
  fireEvent.click(screen.getByRole("button", { name: "Previous" }));
  assert.ok(screen.getByText("course-17"));
});
