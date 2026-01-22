/**
 * File: src/modules/enrollments/enrollments.schema.ts
 * Purpose: Validate enrollment query parameters and creation payloads.
 * Why: Keeps enrollment requests consistent with the PRD data model.
 */
import { EnrollmentRole } from "@prisma/client";
import { z } from "zod";

const pickFirst = (value: unknown) =>
  Array.isArray(value) ? value[0] : value;

const optionalUuid = z.preprocess(
  pickFirst,
  z.string().uuid().optional(),
);

const optionalRole = z.preprocess(
  pickFirst,
  z.nativeEnum(EnrollmentRole).optional(),
);

export const enrollmentQuerySchema = z
  .object({
    courseId: optionalUuid,
    userId: optionalUuid,
    roleInCourse: optionalRole,
  })
  .strip();

export const enrollmentIdParamsSchema = z
  .object({
    enrollmentId: z.string().uuid(),
  })
  .strict();

export const createEnrollmentSchema = z
  .object({
    courseId: z.string().uuid(),
    userId: z.string().uuid(),
    roleInCourse: z.nativeEnum(EnrollmentRole),
  })
  .strict();
