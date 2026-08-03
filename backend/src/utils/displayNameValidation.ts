/**
 * File: src/utils/displayNameValidation.ts
 * Purpose: Define the shared persistence-safe display-name policy.
 * Why: Names shown as identity text must not contain invisible or directional controls.
 */
import { z } from "zod";

import {
  isPostgresSafeText,
  unicodeCodePointLength,
} from "./textValidation.js";

const NON_PRINTING_OR_BIDI_CONTROL_PATTERN = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u;

export const displayNameSchema = z.string().superRefine((value, context) => {
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

  if (NON_PRINTING_OR_BIDI_CONTROL_PATTERN.test(value)) {
    context.addIssue({
      code: "custom",
      message: "Full name must not contain non-printing or bidirectional controls",
    });
  }
});

export const normalizedDisplayNameSchema = z
  .string()
  .trim()
  .pipe(displayNameSchema);
