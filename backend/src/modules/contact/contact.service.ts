/**
 * File: src/modules/contact/contact.service.ts
 * Purpose: Validate and persist recoverable public contact submissions.
 * Why: A single service owns normalization, spam routing, and the public response contract.
 */
import { prisma } from "../../prisma/client.js";
import { contactSubmissionSchema } from "./contact.schema.js";

export type ContactRequestMetadata = {
  source: "public-contact";
  ip: string | null;
  userAgent: string | null;
  referrer: string | null;
};

export type ContactSubmissionResult =
  | { accepted: true }
  | { id: string; status: "new"; submittedAt: string };

export async function createContactSubmission(
  payload: unknown,
  requestMetadata: ContactRequestMetadata,
): Promise<ContactSubmissionResult> {
  const data = contactSubmissionSchema.parse(payload);

  // Return the same generic success class for honeypot traffic without storing spam.
  if (data.website.length > 0) {
    return { accepted: true };
  }

  const submission = await prisma.contactSubmission.create({
    data: {
      name: data.name,
      email: data.email,
      subject: data.subject,
      message: data.message,
      source: requestMetadata.source,
      status: "new",
      metadata: {
        ip: requestMetadata.ip,
        userAgent: requestMetadata.userAgent,
        referrer: requestMetadata.referrer,
      },
    },
    select: { id: true, status: true, createdAt: true },
  });

  return {
    id: submission.id,
    status: "new",
    submittedAt: submission.createdAt.toISOString(),
  };
}
