/**
 * File: src/modules/me/me.schema.ts
 * Purpose: Validate authenticated profile update payloads.
 * Why: Profile fields need a narrow, normalized contract before persistence.
 */
import { z } from "zod";

import { displayNameSchema } from "../../utils/displayNameValidation.js";

const POSTGRES_INTEGER_MAX = 2_147_483_647;

export const updateMeProfileSchema = z
  .object({
    fullName: displayNameSchema,
    expectedRevision: z
      .number()
      .int()
      .nonnegative()
      .max(POSTGRES_INTEGER_MAX)
      .optional(),
  })
  .strict();

export type UpdateMeProfilePayload = z.infer<typeof updateMeProfileSchema>;
