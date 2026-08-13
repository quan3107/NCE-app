/**
 * File: src/modules/me/me.schema.ts
 * Purpose: Validate authenticated profile update payloads.
 * Why: Profile fields need a narrow, normalized contract before persistence.
 */
import { z } from "zod";

import { displayNameSchema } from "../../utils/displayNameValidation.js";

export const updateMeProfileSchema = z
  .object({
    fullName: displayNameSchema,
    expectedRevision: z.number().int().nonnegative(),
  })
  .strict();

export type UpdateMeProfilePayload = z.infer<typeof updateMeProfileSchema>;
