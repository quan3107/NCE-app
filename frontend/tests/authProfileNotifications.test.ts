/**
 * Location: tests/authProfileNotifications.test.ts
 * Purpose: Verify auth profile cache notifications are scoped and deferred.
 * Why: Route query creation must not synchronously update the auth provider.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { setTimeout } from "node:timers/promises";
import {
  profileQueryKey,
  subscribeToProfileCache,
} from "../src/lib/auth-session";
import { queryClient } from "../src/lib/queryClient";

test("profile notifications ignore route queries and notify after cache writes finish", async () => {
  // The live provider has a profile observer; retain its cache in this unit harness.
  queryClient.setQueryDefaults(profileQueryKey("actor-a"), {
    gcTime: Infinity,
  });
  const snapshots: unknown[] = [];
  let writing = false;
  const stop = subscribeToProfileCache("actor-a", () => {
    assert.equal(
      writing,
      false,
      "notification must not run in the rendering/cache-write stack",
    );
    snapshots.push(queryClient.getQueryData(profileQueryKey("actor-a")));
  });
  try {
    queryClient.setQueryData(["homepage"], { title: "Public page" });
    queryClient.setQueryData(profileQueryKey("actor-b"), {
      fullName: "Other actor",
    });
    await setTimeout(10);
    assert.equal(snapshots.length, 0);
    writing = true;
    queryClient.setQueryData(profileQueryKey("actor-a"), {
      fullName: "Current actor",
    });
    assert.equal(snapshots.length, 0);
    writing = false;
    await setTimeout(10);
    assert.ok(snapshots.length > 0);
    assert.deepEqual(snapshots.at(-1), { fullName: "Current actor" });
    const count = snapshots.length;
    queryClient.setQueryData(profileQueryKey("actor-a"), {
      fullName: "Queued update",
    });
    stop();
    await setTimeout(10);
    assert.equal(
      snapshots.length,
      count,
      "unmounted listeners must not receive queued updates",
    );
  } finally {
    stop();
    queryClient.clear();
    queryClient.setQueryDefaults(profileQueryKey("actor-a"), { gcTime: 0 });
  }
});
