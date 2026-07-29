/**
 * File: tests/prisma/contactSubmission.database.test.ts
 * Purpose: Exercise least-privilege idempotent contact writes against PostgreSQL.
 * Why: Mocked Prisma tests cannot prove request roles may execute the real RLS write shape.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { describe, expect, it } from "vitest";

import { Prisma, PrismaClient } from "../../src/prisma/generated.js";
import { contactSubmissionSchema } from "../../src/modules/contact/contact.schema.js";
import { shutdownDatabaseTestClient } from "./databaseTestClient.js";

const databaseDescribe =
  process.env.CI === "true" || process.env.RUN_DATABASE_TESTS === "true"
    ? describe
    : describe.skip;
const rollbackSignal = new Error("ROLLBACK_CONTACT_DATABASE_TEST");
const idempotencyKey = "11111111-1111-4111-8111-111111111111";
const contactMigration = readFileSync(
  resolve(
    process.cwd(),
    "src/prisma/migrations/20260727190000_add_contact_submissions/migration.sql",
  ),
  "utf8",
);
const idempotencyMigration = readFileSync(
  resolve(
    process.cwd(),
    "src/prisma/migrations/20260728150000_bind_contact_idempotency_payload/migration.sql",
  ),
  "utf8",
);

const runRuntimeDatabaseTestTransaction = async <T>(
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> => {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for runtime database tests.");
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const client = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    return await client.$transaction(operation, { timeout: 15_000 });
  } finally {
    await shutdownDatabaseTestClient(client, pool);
  }
};

const canonicalPayload = {
  idempotencyKey,
  name: "Ada Lovelace",
  email: "ada@example.com",
  subject: "Course access",
  message: "Please help me access my course.",
  website: "",
};

const submitAsAnonymousRole = async (
  tx: Prisma.TransactionClient,
  payload = canonicalPayload,
  metadata = { ip: "203.0.113.10" },
): Promise<void> => {
  await tx.$executeRawUnsafe("SET LOCAL ROLE nce_app_anon");
  await tx.$queryRaw(Prisma.sql`
    SELECT app.submit_contact_message(
      ${payload.idempotencyKey}::uuid,
      ${payload.name},
      ${payload.email},
      ${payload.subject},
      ${payload.message},
      ${"public-contact"},
      ${JSON.stringify(metadata)}::jsonb
    )::text
  `);
};

describe("contact submission migration privileges", () => {
  it("limits service-role updates to triage columns", () => {
    expect(contactMigration).toContain(
      "REVOKE ALL ON public.contact_submissions FROM service_role;",
    );
    expect(contactMigration).toContain(
      "GRANT SELECT ON public.contact_submissions TO service_role;",
    );
    expect(contactMigration).toMatch(
      /GRANT UPDATE \(status, updated_at\)\s+ON public\.contact_submissions TO service_role;/,
    );
    expect(contactMigration).not.toContain(
      "GRANT SELECT, UPDATE ON public.contact_submissions TO service_role;",
    );
  });

  it("rejects idempotency keys already bound to different canonical fields", () => {
    expect(idempotencyMigration).toContain(
      "Idempotency key is already bound to a different contact payload.",
    );
    expect(idempotencyMigration).toMatch(
      /WHERE idempotency_key = p_idempotency_key[\s\S]+name = p_name[\s\S]+email = p_email[\s\S]+subject = p_subject[\s\S]+message = p_message/i,
    );
  });
});

databaseDescribe("contact submission database boundary", () => {
  it("lets anonymous write once and service operations update triage state", async () => {
    await expect(
      runRuntimeDatabaseTestTransaction(async (tx) => {
        await submitAsAnonymousRole(tx);
        await submitAsAnonymousRole(tx);

        await tx.$executeRawUnsafe("SET LOCAL ROLE service_role");
        await expect(
          tx.contactSubmission.updateMany({
            where: { idempotencyKey },
            data: { status: "in_progress" },
          }),
        ).resolves.toMatchObject({ count: 1 });
        await expect(
          tx.contactSubmission.count({ where: { idempotencyKey } }),
        ).resolves.toBe(1);
        throw rollbackSignal;
      }),
    ).rejects.toBe(rollbackSignal);
  }, 15_000);

  it("denies service operations permission to rewrite submitted payloads", async () => {
    await expect(
      runRuntimeDatabaseTestTransaction(async (tx) => {
        await tx.$executeRawUnsafe("SET LOCAL ROLE service_role");
        await tx.contactSubmission.updateMany({
          data: { message: "Rewritten after submission." },
        });
      }),
    ).rejects.toThrow(/permission denied/i);
  }, 15_000);

  it("rejects one idempotency key bound to different canonical payloads", async () => {
    await expect(
      runRuntimeDatabaseTestTransaction(async (tx) => {
        await submitAsAnonymousRole(tx);
        await submitAsAnonymousRole(tx, {
          ...canonicalPayload,
          subject: "A different request",
        });
      }),
    ).rejects.toThrow(/different contact payload/i);
  }, 15_000);

  it("round-trips persistable supplementary Unicode without changing it", async () => {
    const payload = contactSubmissionSchema.parse({
      ...canonicalPayload,
      name: "Ada 😀 Lovelace",
      subject: "Course 😀 access",
      message: "Please help 😀 with access.",
    });

    await expect(
      runRuntimeDatabaseTestTransaction(async (tx) => {
        await submitAsAnonymousRole(tx, payload);
        await tx.$executeRawUnsafe("SET LOCAL ROLE service_role");
        const stored = await tx.contactSubmission.findUniqueOrThrow({
          where: { idempotencyKey },
          select: { name: true, subject: true, message: true },
        });
        expect(stored).toEqual({
          name: payload.name,
          subject: payload.subject,
          message: payload.message,
        });
        throw rollbackSignal;
      }),
    ).rejects.toBe(rollbackSignal);
  }, 15_000);
});
