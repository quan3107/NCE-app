/**
 * File: src/modules/enrollments/enrollments.schema.ts
 * Purpose: Validate enrollment query parameters and creation payloads.
 * Why: Keeps enrollment requests consistent with the PRD data model.
 */
import { EnrollmentRole } from "../../prisma/index.js";
import { z } from "zod";

const pickFirst = (value: unknown) =>
  Array.isArray(value) ? value[0] : value;

export const DEFAULT_ENROLLMENT_LIMIT = 50;
const MAX_ENROLLMENT_LIMIT = 100;

const optionalUuid = z.preprocess(
  pickFirst,
  z.string().uuid().optional(),
);

const optionalRole = z.preprocess(
  pickFirst,
  z.nativeEnum(EnrollmentRole).optional(),
);

const optionalLimit = z.preprocess(
  pickFirst,
  z.coerce.number().int().min(1).max(MAX_ENROLLMENT_LIMIT).optional(),
);

const optionalOffset = z.preprocess(
  pickFirst,
  z.coerce.number().int().min(0).optional(),
);

export const enrollmentQuerySchema = z
  .object({
    courseId: optionalUuid,
    userId: optionalUuid,
    roleInCourse: optionalRole,
    limit: optionalLimit,
    offset: optionalOffset,
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
