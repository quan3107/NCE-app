/**
 * File: tests/prisma/settingsWriteBoundary.database.test.ts
 * Purpose: Exercise upload-policy writes through the production runtime role.
 * Why: Static grants and mocked Prisma calls cannot prove the PostgreSQL boundary.
 */
import { afterEach, describe, expect, it } from "vitest";

import {
  cleanupCreatedActors,
  connectRuntimeClient,
  createActor,
  differentLimit,
  readLimit,
  setAuthenticatedRole,
} from "./settingsWriteBoundary.database.helpers.js";

const databaseDescribe =
  process.env.CI === "true" || process.env.RUN_DATABASE_TESTS === "true"
    ? describe
    : describe.skip;

afterEach(cleanupCreatedActors);

databaseDescribe("file upload policy runtime write boundary", () => {
  it("allows an admin-scoped runtime transaction to update a policy", async () => {
    const { client, pool } = await connectRuntimeClient();
    try {
      await client.query("BEGIN");
      const actorId = await createActor({ role: "admin" });
      await setAuthenticatedRole(client, "admin", actorId);
      const expected = await readLimit(client, "student");
      const next = differentLimit(expected);

      const result = await client.query<{ updated: boolean }>(
        "SELECT app.update_file_upload_policy($1, $2, $3) AS updated",
        ["student", expected, next],
      );
      expect(result.rows[0]?.updated).toBe(true);

      const saved = await client.query<{ max_file_size: number }>(
        "SELECT max_file_size FROM public.file_upload_policies WHERE role = 'student'",
      );
      expect(saved.rows[0]?.max_file_size).toBe(next);
    } finally {
      await client.query("ROLLBACK");
      client.release();
      await pool.end();
    }
  });

  it.each(["student", "teacher"] as const)(
    "rejects a %s-scoped runtime transaction",
    async (userRole) => {
      const { client, pool } = await connectRuntimeClient();
      try {
        await client.query("BEGIN");
        const actorId = await createActor({ role: userRole });
        await setAuthenticatedRole(client, userRole, actorId);
        await expect(
          client.query(
            "SELECT app.update_file_upload_policy($1, $2, $3) AS updated",
            ["student", 10 * 1024 * 1024, 11 * 1024 * 1024],
          ),
        ).rejects.toMatchObject({ code: "42501" });
      } finally {
        await client.query("ROLLBACK");
        client.release();
        await pool.end();
      }
    },
  );

  it.each([
    ["suspended", { role: "admin", status: "suspended" }],
    ["soft-deleted", { role: "admin", deleted: true }],
    ["role-demoted", { role: "student" }],
  ] as const)(
    "rejects a token-admin transaction for a %s actor",
    async (_label, actorOptions) => {
      const { client, pool } = await connectRuntimeClient();
      try {
        await client.query("BEGIN");
        const actorId = await createActor(actorOptions);
        await setAuthenticatedRole(client, "admin", actorId);
        await expect(
          client.query(
            "SELECT app.update_file_upload_policy($1, $2, $3) AS updated",
            ["student", 10 * 1024 * 1024, 11 * 1024 * 1024],
          ),
        ).rejects.toMatchObject({ code: "42501" });
      } finally {
        await client.query("ROLLBACK");
        client.release();
        await pool.end();
      }
    },
  );

  it("rejects fractional-MiB values at the database write boundary", async () => {
    const { client, pool } = await connectRuntimeClient();
    try {
      await client.query("BEGIN");
      const actorId = await createActor({ role: "admin" });
      await setAuthenticatedRole(client, "admin", actorId);
      const expected = await readLimit(client, "student");

      await expect(
        client.query(
          "SELECT app.update_file_upload_policy($1, $2, $3) AS updated",
          ["student", expected, expected + 1],
        ),
      ).rejects.toMatchObject({ code: "23514" });
    } finally {
      await client.query("ROLLBACK");
      client.release();
      await pool.end();
    }
  });

  it("allows concurrent disjoint role updates", async () => {
    const first = await connectRuntimeClient();
    const second = await connectRuntimeClient();
    try {
      await Promise.all([
        first.client.query("BEGIN"),
        second.client.query("BEGIN"),
      ]);
      await Promise.all([
        createActor({ role: "admin" }).then((actorId) =>
          setAuthenticatedRole(first.client, "admin", actorId),
        ),
        createActor({ role: "admin" }).then((actorId) =>
          setAuthenticatedRole(second.client, "admin", actorId),
        ),
      ]);
      const [student, teacher] = await Promise.all([
        readLimit(first.client, "student"),
        readLimit(second.client, "teacher"),
      ]);

      const [studentResult, teacherResult] = await Promise.all([
        first.client.query<{ updated: boolean }>(
          "SELECT app.update_file_upload_policy($1, $2, $3) AS updated",
          ["student", student, differentLimit(student)],
        ),
        second.client.query<{ updated: boolean }>(
          "SELECT app.update_file_upload_policy($1, $2, $3) AS updated",
          ["teacher", teacher, differentLimit(teacher)],
        ),
      ]);

      expect(studentResult.rows[0]?.updated).toBe(true);
      expect(teacherResult.rows[0]?.updated).toBe(true);
    } finally {
      await Promise.allSettled([
        first.client.query("ROLLBACK"),
        second.client.query("ROLLBACK"),
      ]);
      first.client.release();
      second.client.release();
      await Promise.all([first.pool.end(), second.pool.end()]);
    }
  });

  it("lets only one concurrent same-role expected-value update win", async () => {
    const first = await connectRuntimeClient();
    const second = await connectRuntimeClient();
    let expected: number | undefined;
    let winner: number | undefined;
    let firstCommitted = false;
    let firstActorId: string | undefined;
    try {
      await Promise.all([
        first.client.query("BEGIN"),
        second.client.query("BEGIN"),
      ]);
      const [createdFirstActorId, secondActorId] = await Promise.all([
        createActor({ role: "admin" }),
        createActor({ role: "admin" }),
      ]);
      firstActorId = createdFirstActorId;
      await Promise.all([
        setAuthenticatedRole(first.client, "admin", createdFirstActorId),
        setAuthenticatedRole(second.client, "admin", secondActorId),
      ]);
      expected = await readLimit(first.client, "student");
      winner = differentLimit(expected);
      const loser =
        expected === 100 * 1024 * 1024
          ? expected - 2 * 1024 * 1024
          : expected + 1024 * 1024;

      const firstResult = await first.client.query<{ updated: boolean }>(
        "SELECT app.update_file_upload_policy($1, $2, $3) AS updated",
        ["student", expected, winner],
      );
      const secondUpdate = second.client.query<{ updated: boolean }>(
        "SELECT app.update_file_upload_policy($1, $2, $3) AS updated",
        ["student", expected, loser],
      );
      await first.client.query("COMMIT");
      firstCommitted = true;
      const secondResult = await secondUpdate;

      expect(firstResult.rows[0]?.updated).toBe(true);
      expect(secondResult.rows[0]?.updated).toBe(false);
    } finally {
      await second.client.query("ROLLBACK").catch(() => undefined);
      if (
        firstCommitted &&
        expected !== undefined &&
        winner !== undefined &&
        firstActorId
      ) {
        await first.client.query("BEGIN");
        await setAuthenticatedRole(first.client, "admin", firstActorId);
        await first.client.query(
          "SELECT app.update_file_upload_policy($1, $2, $3)",
          ["student", winner, expected],
        );
        await first.client.query("COMMIT");
      } else {
        await first.client.query("ROLLBACK").catch(() => undefined);
      }
      first.client.release();
      second.client.release();
      await Promise.all([first.pool.end(), second.pool.end()]);
    }
  });
});
