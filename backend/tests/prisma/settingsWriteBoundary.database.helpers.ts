/**
 * File: tests/prisma/settingsWriteBoundary.database.helpers.ts
 * Purpose: Create runtime connections and disposable actors for settings probes.
 * Why: Database-boundary tests need owner fixtures without granting runtime writes.
 */
import { randomUUID } from "node:crypto";

import type { Pool, PoolClient } from "pg";
import { Pool as PgPool } from "pg";

import { createDatabaseTestOwnerPool } from "./databaseTestClient.js";

const createdActorIds: string[] = [];

export async function connectRuntimeClient(): Promise<{
  client: PoolClient;
  pool: Pool;
}> {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for runtime database tests.");
  }
  const pool = new PgPool({ connectionString: databaseUrl });
  return { client: await pool.connect(), pool };
}

export async function setAuthenticatedRole(
  client: PoolClient,
  userRole: "admin" | "student" | "teacher",
  userId: string,
): Promise<void> {
  await client.query("SET LOCAL ROLE nce_app_authenticated");
  await client.query("SELECT set_config('app.current_user_id', $1, true)", [
    userId,
  ]);
  await client.query("SELECT set_config('app.current_user_role', $1, true)", [
    userRole,
  ]);
}

export async function createActor(options: {
  role: "admin" | "student" | "teacher";
  status?: "active" | "suspended";
  deleted?: boolean;
}): Promise<string> {
  const pool = createDatabaseTestOwnerPool();
  try {
    const result = await pool.query<{ id: string }>(
      `INSERT INTO public.users (
        email, full_name, role, status, "deletedAt"
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING id`,
      [
        `settings-boundary-${randomUUID()}@example.com`,
        "Settings Boundary Actor",
        options.role,
        options.status ?? "active",
        options.deleted ? new Date() : null,
      ],
    );
    const actorId = result.rows[0]?.id;
    if (!actorId) {
      throw new Error("Settings boundary actor was not created.");
    }
    createdActorIds.push(actorId);
    return actorId;
  } finally {
    await pool.end();
  }
}

export async function cleanupCreatedActors(): Promise<void> {
  if (createdActorIds.length === 0) return;
  const pool = createDatabaseTestOwnerPool();
  const actorIds = createdActorIds.splice(0);
  try {
    await pool.query("DELETE FROM public.users WHERE id = ANY($1::uuid[])", [
      actorIds,
    ]);
  } finally {
    await pool.end();
  }
}

export async function readLimit(
  client: PoolClient,
  role: "student" | "teacher",
): Promise<number> {
  const result = await client.query<{ max_file_size: number }>(
    "SELECT max_file_size FROM public.file_upload_policies WHERE role = $1",
    [role],
  );
  const value = result.rows[0]?.max_file_size;
  if (typeof value !== "number") {
    throw new Error(`${role} upload policy fixture is missing.`);
  }
  return value;
}

export const differentLimit = (value: number): number =>
  value === 1024 * 1024 ? 2 * 1024 * 1024 : value - 1024 * 1024;
