/// <reference lib="dom" />
/**
 * Location: tests/adminAuditLogs.test.ts
 * Purpose: Verify admin audit DTOs retain their target entity identifiers.
 * Why: Marker-only events need entity IDs to remain distinguishable in the UI.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { toAuditLog } from "../src/features/admin/api";

test("toAuditLog preserves entityId from the API response", () => {
  const auditLog = toAuditLog({
    id: "audit-1",
    actorId: null,
    actor: null,
    action: "course.updated",
    entity: "course",
    entityId: "course-17",
    eventData: { titleChanged: true },
    schemaVersion: 1,
    createdAt: "2026-07-25T12:00:00.000Z",
  });

  assert.equal(auditLog.entityId, "course-17");
});
