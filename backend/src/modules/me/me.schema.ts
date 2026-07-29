/**
 * File: src/modules/me/me.schema.ts
 * Purpose: Validate authenticated profile update payloads.
 * Why: Profile fields need a narrow, normalized contract before persistence.
 */
import { z } from "zod";

import {
  isPostgresSafeText,
  unicodeCodePointLength,
} from "../../utils/textValidation.js";

export const updateMeProfileSchema = z
  .object({
    fullName: z.string().superRefine((value, context) => {
      if (value !== value.trim()) {
        context.addIssue({
          code: "custom",
          message: "Full name must not have leading or trailing whitespace",
        });
      }

      const codePointLength = unicodeCodePointLength(value);
      if (codePointLength < 2 || codePointLength > 100) {
        context.addIssue({
          code: "custom",
          message: "Full name must contain between 2 and 100 Unicode characters",
        });
      }

      if (!isPostgresSafeText(value)) {
        context.addIssue({
          code: "custom",
          message: "Full name must contain only PostgreSQL-safe Unicode text",
        });
      }
    }),
  })
  .strict();

export type UpdateMeProfilePayload = z.infer<typeof updateMeProfileSchema>;
