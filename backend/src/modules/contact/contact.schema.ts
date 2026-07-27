/**
 * File: src/modules/contact/contact.schema.ts
 * Purpose: Validate anonymous contact form submissions at the API boundary.
 * Why: Strict bounds keep persisted messages useful and limit abuse payload size.
 */
import { z } from "zod";

const canonicalText = (minimum: number, maximum: number) =>
  z
    .string()
    .min(minimum)
    .max(maximum)
    .refine((value) => value === value.trim(), {
      message: "Must not have leading or trailing whitespace.",
    });

export const contactSubmissionSchema = z
  .object({
    idempotencyKey: z.string().uuid(),
    name: canonicalText(2, 120),
    email: z
      .string()
      .email()
      .max(254)
      .refine((value) => value === value.trim(), {
        message: "Must not have leading or trailing whitespace.",
      })
      .transform((value) => value.toLowerCase()),
    subject: canonicalText(3, 160),
    message: canonicalText(10, 5_000),
    // Hidden from assistive technology and normal users; filled values identify simple bots.
    website: z.string().max(500).optional().default(""),
  })
  .strict();

export type ContactSubmissionInput = z.input<typeof contactSubmissionSchema>;
