/**
 * Location: tests/authInvalidation.component.test.tsx
 * Purpose: Verify shared auth data can only trigger server revalidation.
 * Why: Storage failures, legacy snapshots, and peer messages must never grant authority.
 */

import assert from "node:assert/strict";

import { afterEach, beforeEach, test, vi } from "vitest";

import { AuthCoordinator } from "../src/lib/auth-coordinator";
import {
  publishAuthInvalidation,
  removeLegacyAuthSnapshot,
  subscribeToAuthInvalidation,
} from "../src/lib/shared-auth-session";

const localValues = new Map<string, string>();
const sessionValues = new Map<string, string>();
const mapStorage = (values: Map<string, string>): Storage => ({
  get length() { return values.size; },
  clear: () => values.clear(),
  getItem: (key) => values.get(key) ?? null,
  key: (index) => [...values.keys()][index] ?? null,
  removeItem: (key) => void values.delete(key),
  setItem: (key, value) => void values.set(key, value),
});

beforeEach(() => {
  localValues.clear();
  sessionValues.clear();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: mapStorage(localValues),
  });
  Object.defineProperty(window, "sessionStorage", {
    configurable: true,
    value: mapStorage(sessionValues),
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

test("legacy stored admin authority is removed without authentication", () => {
  window.localStorage.setItem(
    "currentUser",
    JSON.stringify({
      token: "stored-admin-token",
      liveUser: { id: "admin-1", role: "admin" },
    }),
  );
  const coordinator = new AuthCoordinator();
  removeLegacyAuthSnapshot();
  coordinator.finishBootstrap();

  assert.equal(window.localStorage.getItem("currentUser"), null);
  assert.equal(coordinator.getSnapshot().status, "anonymous");
});

test("partial storage failure cannot expose old authority in a fresh tab", () => {
  window.localStorage.setItem(
    "currentUser",
    JSON.stringify({ token: "old-token", liveUser: { id: "old-admin" } }),
  );
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      ...mapStorage(localValues),
      removeItem: () => {
        throw new DOMException("blocked", "SecurityError");
      },
    },
  });
  const freshTab = new AuthCoordinator();
  removeLegacyAuthSnapshot();
  freshTab.finishBootstrap();

  assert.equal(freshTab.getSnapshot().status, "anonymous");
  assert.throws(() => freshTab.admit("required"), /required/i);
});

test("subscriber catches an invalidation written before catch-up read", () => {
  const message = {
    schemaVersion: 1,
    epoch: 77,
    reason: "server-revalidate",
    nonce: "between-read-and-subscribe",
  };
  window.localStorage.setItem("nce:auth-invalidation", JSON.stringify(message));
  const observed: unknown[] = [];
  const unsubscribe = subscribeToAuthInvalidation((value) => observed.push(value));
  unsubscribe();

  assert.deepEqual(observed, [message]);
});

test("storage and notification failures never create authority", () => {
  const coordinator = new AuthCoordinator();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      ...mapStorage(localValues),
      setItem: () => {
        throw new DOMException("quota", "QuotaExceededError");
      },
    },
  });
  vi.stubGlobal(
    "BroadcastChannel",
    class {
      postMessage() {
        throw new Error("notifications blocked");
      }
      close() {}
    },
  );
  const invalidation = publishAuthInvalidation("server-revalidate");
  coordinator.finishBootstrap();

  assert.equal(invalidation.schemaVersion, 1);
  assert.equal(coordinator.getSnapshot().status, "anonymous");
  assert.doesNotMatch(JSON.stringify(invalidation), /token|liveUser|profile/i);
});
