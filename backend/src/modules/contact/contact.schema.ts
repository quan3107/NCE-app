/**
 * File: src/modules/contact/contact.schema.ts
 * Purpose: Validate anonymous contact form submissions at the API boundary.
 * Why: Strict bounds keep persisted messages useful and limit abuse payload size.
 */
import { z } from "zod";

import {
  isPostgresSafeText,
  unicodeCodePointLength,
} from "../../utils/textValidation.js";

const canonicalText = (minimum: number, maximum: number) =>
  z
    .string()
    .refine((value) => unicodeCodePointLength(value) >= minimum, {
      message: `Must contain at least ${minimum} Unicode characters.`,
    })
    .refine((value) => unicodeCodePointLength(value) <= maximum, {
      message: `Must contain at most ${maximum} Unicode characters.`,
    })
    .refine((value) => value === value.trim(), {
      message: "Must not have leading or trailing whitespace.",
    })
    .refine(isPostgresSafeText, {
      message: "Must contain only PostgreSQL-safe Unicode text.",
    });

export const contactSubmissionSchema = z
  .object({
    idempotencyKey: z.string().uuid(),
    name: canonicalText(2, 120),
    email: z
      .string()
      .email()
      .refine((value) => unicodeCodePointLength(value) <= 254, {
        message: "Must contain at most 254 Unicode characters.",
      })
      .refine((value) => value === value.trim(), {
        message: "Must not have leading or trailing whitespace.",
      })
      .transform((value) => value.toLowerCase()),
    subject: canonicalText(3, 160),
    message: canonicalText(10, 5_000),
    // Hidden from assistive technology and normal users; filled values identify simple bots.
    website: z
      .string()
      .refine((value) => unicodeCodePointLength(value) <= 500, {
        message: "Must contain at most 500 Unicode characters.",
      })
      .optional()
      .default(""),
  })
  .strict();

export const contactHoneypotSchema = contactSubmissionSchema.shape.website;
export type ContactSubmissionInput = z.input<typeof contactSubmissionSchema>;
