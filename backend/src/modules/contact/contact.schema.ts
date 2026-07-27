/**
 * File: src/modules/contact/contact.schema.ts
 * Purpose: Validate anonymous contact form submissions at the API boundary.
 * Why: Strict bounds keep persisted messages useful and limit abuse payload size.
 */
import { z } from "zod";

const trimmedText = (minimum: number, maximum: number) =>
  z.string().trim().min(minimum).max(maximum);

export const contactSubmissionSchema = z
  .object({
    name: trimmedText(2, 120),
    email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
    subject: trimmedText(3, 160),
    message: trimmedText(10, 5_000),
    // Hidden from assistive technology and normal users; filled values identify simple bots.
    website: z.string().max(500).optional().default(""),
  })
  .strict();

export type ContactSubmissionInput = z.input<typeof contactSubmissionSchema>;
