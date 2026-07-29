/**
 * File: src/modules/me/me.schema.ts
 * Purpose: Validate authenticated profile update payloads.
 * Why: Profile fields need a narrow, normalized contract before persistence.
 */
import { z } from "zod";

export const updateMeProfileSchema = z
  .object({
    fullName: z.string().trim().min(2).max(100),
  })
  .strict();

export type UpdateMeProfilePayload = z.infer<typeof updateMeProfileSchema>;
