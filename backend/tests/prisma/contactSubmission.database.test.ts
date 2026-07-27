/**
 * File: tests/prisma/contactSubmission.database.test.ts
 * Purpose: Exercise least-privilege idempotent contact writes against PostgreSQL.
 * Why: Mocked Prisma tests cannot prove request roles may execute the real RLS write shape.
 */
import { describe, expect, it } from "vitest";

import { Prisma } from "../../src/prisma/generated.js";
import { runDatabaseTestTransaction } from "./databaseTestClient.js";

const databaseDescribe =
  process.env.CI === "true" || process.env.RUN_DATABASE_TESTS === "true"
    ? describe
    : describe.skip;
const rollbackSignal = new Error("ROLLBACK_CONTACT_DATABASE_TEST");
const idempotencyKey = "11111111-1111-4111-8111-111111111111";

const submitAsAnonymousRole = async (
  tx: Prisma.TransactionClient,
): Promise<void> => {
  await tx.$executeRawUnsafe("SET LOCAL ROLE nce_app_anon");
  await tx.$queryRaw(Prisma.sql`
    SELECT app.submit_contact_message(
      ${idempotencyKey}::uuid,
      ${"Ada Lovelace"},
      ${"ada@example.com"},
      ${"Course access"},
      ${"Please help me access my course."},
      ${"public-contact"},
      ${JSON.stringify({ ip: "203.0.113.10" })}::jsonb
    )
  `);
  await tx.$executeRawUnsafe("RESET ROLE");
};

databaseDescribe("contact submission database boundary", () => {
  it("lets the anonymous request role write once without table SELECT", async () => {
    await expect(
      runDatabaseTestTransaction(async (tx) => {
        await tx.contactSubmission.deleteMany({ where: { idempotencyKey } });

        await submitAsAnonymousRole(tx);
        await submitAsAnonymousRole(tx);

        await expect(
          tx.contactSubmission.count({ where: { idempotencyKey } }),
        ).resolves.toBe(1);
        throw rollbackSignal;
      }),
    ).rejects.toBe(rollbackSignal);
  }, 15_000);
});
