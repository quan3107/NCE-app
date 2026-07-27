/**
 * File: src/modules/audit-logs/contracts/courses-enrollments.ts
 * Purpose: Define strict course and enrollment audit event contracts.
 * Why: Membership and lifecycle changes need identifiers and markers, not complete records.
 */
import { z } from "zod";

import { auditIdSchema, changedMarkerSchema, enrollmentRoleSchema } from "./common.js";

const membershipShape = {
  courseId: auditIdSchema,
  userId: auditIdSchema,
  roleInCourse: enrollmentRoleSchema,
  membershipChanged: changedMarkerSchema,
};

export const courseEnrollmentAuditContracts = {
  "course.created": {
    entity: "course",
    schema: z.strictObject({ ownerTeacherId: auditIdSchema }),
  },
  "course.updated": {
    entity: "course",
    schema: z.strictObject({
      titleChanged: changedMarkerSchema.optional(),
      descriptionChanged: changedMarkerSchema.optional(),
      learningOutcomesChanged: changedMarkerSchema.optional(),
      structureSummaryChanged: changedMarkerSchema.optional(),
      prerequisitesSummaryChanged: changedMarkerSchema.optional(),
      scheduleChanged: changedMarkerSchema.optional(),
    }),
  },
  "course.archived": {
    entity: "course",
    schema: z.strictObject({ lifecycleChanged: changedMarkerSchema }),
  },
  "course.restored": {
    entity: "course",
    schema: z.strictObject({ lifecycleChanged: changedMarkerSchema }),
  },
  "course.teacher_added": {
    entity: "enrollment",
    schema: z.strictObject(membershipShape),
  },
  "course.teacher_removed": {
    entity: "enrollment",
    schema: z.strictObject(membershipShape),
  },
  "course.student_added": {
    entity: "enrollment",
    schema: z.strictObject(membershipShape),
  },
  "course.student_removed": {
    entity: "enrollment",
    schema: z.strictObject(membershipShape),
  },
  "enrollment.created": {
    entity: "enrollment",
    schema: z.strictObject({
      courseId: auditIdSchema,
      userId: auditIdSchema,
      roleInCourse: enrollmentRoleSchema,
    }),
  },
  "enrollment.deleted": {
    entity: "enrollment",
    schema: z.strictObject(membershipShape),
  },
} as const;
