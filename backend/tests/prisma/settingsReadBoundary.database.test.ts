/**
 * File: tests/prisma/settingsReadBoundary.database.test.ts
 * Purpose: Exercise settings-read authorization and actor lookup plans in PostgreSQL.
 * Why: Mocked transactions cannot prove demotion blocking or primary-key access paths.
 */
import { afterEach, describe, expect, it } from "vitest";

import { getFileUploadLimits } from "../../src/modules/settings/settings.service.js";
import { withRoleContext } from "../../src/prisma/client.js";
import { createDatabaseTestOwnerPool } from "./databaseTestClient.js";
import {
  cleanupCreatedActors,
  connectRuntimeClient,
  createActor,
  setAuthenticatedRole,
} from "./settingsWriteBoundary.database.helpers.js";

const databaseDescribe =
  process.env.CI === "true" || process.env.RUN_DATABASE_TESTS === "true"
    ? describe
    : describe.skip;

afterEach(cleanupCreatedActors);

databaseDescribe("settings read database boundary", () => {
  it("rechecks a concurrent demotion before reading policies", async () => {
    const actorId = await createActor({ role: "admin" });
    const ownerPool = createDatabaseTestOwnerPool();
    const owner = await ownerPool.connect();
    let committed = false;

    try {
      await owner.query("BEGIN");
      await owner.query(
        "UPDATE public.users SET role = 'student' WHERE id = $1::uuid",
        [actorId],
      );
      await owner.query(
        "LOCK TABLE public.file_upload_policies IN ACCESS EXCLUSIVE MODE",
      );

      let settled = false;
      const read = Promise.resolve(
        withRoleContext(
          {
            role: "nce_app_authenticated",
            userId: actorId,
            userRole: "admin",
          },
          () => getFileUploadLimits(actorId),
        ),
      ).finally(() => {
        settled = true;
      });
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(settled).toBe(false);

      await owner.query("COMMIT");
      committed = true;
      await expect(read).rejects.toMatchObject({ statusCode: 403 });
    } finally {
      if (!committed) await owner.query("ROLLBACK").catch(() => undefined);
      owner.release();
      await ownerPool.end();
    }
  });

  it("uses the users primary-key index for the UUID actor lookup", async () => {
    const actorId = await createActor({ role: "admin" });
    const { client, pool } = await connectRuntimeClient();

    try {
      await client.query("BEGIN");
      await setAuthenticatedRole(client, "admin", actorId);
      await client.query("SET LOCAL enable_seqscan = off");
      const plan = await client.query(
        `EXPLAIN (FORMAT JSON)
         SELECT users.id
         FROM public.users AS users
         WHERE users.id = current_setting('app.current_user_id', true)::UUID
           AND users.role = 'admin'
           AND users.status = 'active'
           AND users."deletedAt" IS NULL
         FOR SHARE`,
      );

      expect(JSON.stringify(plan.rows)).toContain("users_pkey");
    } finally {
      await client.query("ROLLBACK");
      client.release();
      await pool.end();
    }
  });
});
