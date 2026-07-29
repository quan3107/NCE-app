/**
 * File: tests/prisma/settingsWriteBoundary.database.test.ts
 * Purpose: Exercise upload-policy writes through the production runtime role.
 * Why: Static grants and mocked Prisma calls cannot prove the PostgreSQL boundary.
 */
import type { PoolClient } from "pg";
import { Pool } from "pg";
import { describe, expect, it } from "vitest";

const databaseDescribe =
  process.env.CI === "true" || process.env.RUN_DATABASE_TESTS === "true"
    ? describe
    : describe.skip;

const connectRuntimeClient = async (): Promise<{
  client: PoolClient;
  pool: Pool;
}> => {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for runtime database tests.");
  }
  const pool = new Pool({ connectionString: databaseUrl });
  return { client: await pool.connect(), pool };
};

const setAuthenticatedRole = async (
  client: PoolClient,
  userRole: "admin" | "student" | "teacher",
): Promise<void> => {
  await client.query("SET LOCAL ROLE nce_app_authenticated");
  await client.query(
    "SELECT set_config('app.current_user_role', $1, true)",
    [userRole],
  );
};

const readLimit = async (
  client: PoolClient,
  role: "student" | "teacher",
): Promise<number> => {
  const result = await client.query<{ max_file_size: number }>(
    "SELECT max_file_size FROM public.file_upload_policies WHERE role = $1",
    [role],
  );
  const value = result.rows[0]?.max_file_size;
  if (typeof value !== "number") {
    throw new Error(`${role} upload policy fixture is missing.`);
  }
  return value;
};

const differentLimit = (value: number): number =>
  value === 1024 * 1024 ? 2 * 1024 * 1024 : value - 1024 * 1024;

databaseDescribe("file upload policy runtime write boundary", () => {
  it("allows an admin-scoped runtime transaction to update a policy", async () => {
    const { client, pool } = await connectRuntimeClient();
    try {
      await client.query("BEGIN");
      await setAuthenticatedRole(client, "admin");
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
        await setAuthenticatedRole(client, userRole);
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

  it("allows concurrent disjoint role updates", async () => {
    const first = await connectRuntimeClient();
    const second = await connectRuntimeClient();
    try {
      await Promise.all([
        first.client.query("BEGIN"),
        second.client.query("BEGIN"),
      ]);
      await Promise.all([
        setAuthenticatedRole(first.client, "admin"),
        setAuthenticatedRole(second.client, "admin"),
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
    try {
      await Promise.all([
        first.client.query("BEGIN"),
        second.client.query("BEGIN"),
      ]);
      await Promise.all([
        setAuthenticatedRole(first.client, "admin"),
        setAuthenticatedRole(second.client, "admin"),
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
      if (firstCommitted && expected !== undefined && winner !== undefined) {
        await first.client.query("BEGIN");
        await setAuthenticatedRole(first.client, "admin");
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
