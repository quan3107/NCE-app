/**
 * File: src/modules/contact/contact.service.ts
 * Purpose: Validate and persist recoverable public contact submissions.
 * Why: A single service owns normalization, spam routing, and the public response contract.
 */
import { prisma } from "../../prisma/client.js";
import { Prisma } from "../../prisma/index.js";
import { contactSubmissionSchema } from "./contact.schema.js";

export type ContactRequestMetadata = {
  source: "public-contact";
  ip: string | null;
  userAgent: string | null;
  referrer: string | null;
};

export type ContactSubmissionResult = { accepted: true };

function isHoneypotSubmission(payload: unknown): boolean {
  if (typeof payload !== "object" || payload === null) return false;
  const website = (payload as Record<string, unknown>).website;
  if (typeof website === "string") return website.length > 0;
  return website !== undefined && website !== null;
}

export async function createContactSubmission(
  payload: unknown,
  requestMetadata: ContactRequestMetadata,
): Promise<ContactSubmissionResult> {
  // Classify the bounded trap field before normal validation so spam receives
  // the exact same external outcome even when its visible fields are malformed.
  if (isHoneypotSubmission(payload)) {
    return { accepted: true };
  }

  const data = contactSubmissionSchema.parse(payload);
  const metadata = JSON.stringify({
    ip: requestMetadata.ip,
    userAgent: requestMetadata.userAgent,
    referrer: requestMetadata.referrer,
  });

  // The security-definer function owns table access and deduplicates retries.
  // Request roles receive EXECUTE only; no protected row is returned.
  await prisma.$queryRaw(Prisma.sql`
    SELECT app.submit_contact_message(
      ${data.idempotencyKey}::uuid,
      ${data.name},
      ${data.email},
      ${data.subject},
      ${data.message},
      ${requestMetadata.source},
      ${metadata}::jsonb
    )
  `);

  return { accepted: true };
}
