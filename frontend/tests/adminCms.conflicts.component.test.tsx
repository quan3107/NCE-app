/**
 * Location: tests/adminCms.conflicts.component.test.tsx
 * Purpose: Verify CMS mutation conflicts remain visible when the editor is clean.
 * Why: Publish and rollback refetch the draft after a 409, so no dirty-state banner remains.
 */
import assert from "node:assert/strict";
import { cleanup, screen } from "@testing-library/react";
import { afterEach, test, vi } from "vitest";

import { renderAdminCmsPage } from "./adminCms.test-utils";
import {
  cmsState,
  resetCmsComponentState,
} from "./adminCms.component.fixture";

vi.mock("@features/admin/cmsApi", () =>
  import("./adminCms.component.fixture"),
);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  resetCmsComponentState();
});

test("shows publish and rollback version conflicts in a clean editor", () => {
  cmsState.publishError = Object.assign(new Error("version conflict"), {
    status: 409,
  });
  cmsState.rollbackError = Object.assign(new Error("version conflict"), {
    status: 409,
  });

  renderAdminCmsPage();

  assert.ok(
    screen.getByText(
      "The draft changed before it could be published. Review the refreshed draft and try again.",
    ),
  );
  assert.ok(
    screen.getByText(
      "The draft changed before the revision could be restored. Review the refreshed draft and try again.",
    ),
  );
  assert.ok(
    screen.queryByText(
      "This draft changed on the server. Reload before saving or publishing.",
    ) === null,
  );
});
