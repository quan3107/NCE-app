/**
 * File: src/modules/contact/contact.service.ts
 * Purpose: Validate and persist recoverable public contact submissions.
 * Why: A single service owns normalization, spam routing, and the public response contract.
 */
import { prisma } from "../../prisma/client.js";
import { Prisma } from "../../prisma/index.js";
import {
  contactHoneypotSchema,
  contactSubmissionSchema,
} from "./contact.schema.js";

export type ContactRequestMetadata = {
  source: "public-contact";
  ip: string | null;
  userAgent: string | null;
  referrer: string | null;
};

export type ContactSubmissionResult = { accepted: true };

const IDEMPOTENCY_CONFLICT_MESSAGE =
  "Idempotency key is already bound to a different contact payload.";

type RawQueryErrorMeta = {
  driverAdapterError?: {
    cause?: {
      originalCode?: unknown;
      originalMessage?: unknown;
    };
  };
};

function isIdempotencyPayloadConflict(error: unknown): boolean {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== "P2010"
  ) {
    return false;
  }
  const cause = (error.meta as RawQueryErrorMeta | undefined)
    ?.driverAdapterError?.cause;
  return (
    cause?.originalCode === "23505" &&
    typeof cause.originalMessage === "string" &&
    cause.originalMessage.includes(IDEMPOTENCY_CONFLICT_MESSAGE)
  );
}

function createIdempotencyConflict(): Error & {
  statusCode: number;
  expose: boolean;
} {
  return Object.assign(new Error(IDEMPOTENCY_CONFLICT_MESSAGE), {
    statusCode: 409,
    expose: true,
  });
}

function isHoneypotSubmission(payload: unknown): boolean {
  const website =
    typeof payload === "object" && payload !== null
      ? (payload as Record<string, unknown>).website
      : undefined;
  return contactHoneypotSchema.parse(website).length > 0;
}

export async function createContactSubmission(
  payload: unknown,
  requestMetadata: ContactRequestMetadata,
): Promise<ContactSubmissionResult> {
  // Validate the trap field before classification, then mask valid nonempty
  // values even when the visible fields are malformed.
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
  try {
    await prisma.$queryRaw(Prisma.sql`
      SELECT app.submit_contact_message(
        ${data.idempotencyKey}::uuid,
        ${data.name},
        ${data.email},
        ${data.subject},
        ${data.message},
        ${requestMetadata.source},
        ${metadata}::jsonb
      )::text
    `);
  } catch (error) {
    if (isIdempotencyPayloadConflict(error)) {
      throw createIdempotencyConflict();
    }
    throw error;
  }

  return { accepted: true };
}
