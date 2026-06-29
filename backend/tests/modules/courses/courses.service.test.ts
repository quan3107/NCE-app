/**
 * File: tests/modules/courses/courses.service.test.ts
 * Purpose: Verify course write-side validation rules.
 * Why: Prevents impossible course ownership states from being persisted.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserRole, UserStatus } from "../../../src/prisma/index.js";

vi.mock("../../../src/prisma/client.js", () => ({
  prisma: {
    course: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("../../../src/modules/audit-logs/audit-logs.service.js", () => ({
  writeAuditLogSafely: vi.fn(),
}));

const prismaModule = await import("../../../src/prisma/client.js");
const prisma = vi.mocked(prismaModule.prisma, true);
const auditLogsModule = await import(
  "../../../src/modules/audit-logs/audit-logs.service.js"
);
const writeAuditLogSafely = vi.mocked(auditLogsModule.writeAuditLogSafely);

const { createCourse } = await import(
  "../../../src/modules/courses/courses.service.js"
);
const { archiveCourse, restoreCourse, updateCourse } = await import(
  "../../../src/modules/courses/courses.service.js"
);

const validCoursePayload = {
  title: "IELTS Writing Intensive",
  ownerTeacherId: "11111111-1111-4111-8111-111111111111",
};
const courseId = "22222222-2222-4222-8222-222222222222";
const ownerId = validCoursePayload.ownerTeacherId;
const adminActor = {
  id: "33333333-3333-4333-8333-333333333333",
  role: UserRole.admin,
};
const ownerActor = {
  id: ownerId,
  role: UserRole.teacher,
};
const studentActor = {
  id: "44444444-4444-4444-8444-444444444444",
  role: UserRole.student,
};

describe("courses.service.createCourse", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a course when the owner is an active teacher", async () => {
    const createdCourse = {
      id: "22222222-2222-4222-8222-222222222222",
      title: validCoursePayload.title,
      description: null,
      ownerId: validCoursePayload.ownerTeacherId,
      scheduleJson: null,
      createdAt: new Date("2026-05-29T00:00:00.000Z"),
      updatedAt: new Date("2026-05-29T00:00:00.000Z"),
      deletedAt: null,
    };
    prisma.user.findFirst.mockResolvedValueOnce({
      id: validCoursePayload.ownerTeacherId,
      role: UserRole.teacher,
      status: UserStatus.active,
    });
    prisma.course.create.mockResolvedValueOnce(createdCourse);

    const result = await createCourse(validCoursePayload);

    expect(prisma.course.create).toHaveBeenCalledWith({
      data: {
        title: validCoursePayload.title,
        description: undefined,
        ownerId: validCoursePayload.ownerTeacherId,
        scheduleJson: undefined,
      },
    });
    expect(writeAuditLogSafely).toHaveBeenCalledWith({
      actorId: validCoursePayload.ownerTeacherId,
      action: "course.created",
      entity: "course",
      entityId: createdCourse.id,
      after: createdCourse,
    });
    expect(result).toBe(createdCourse);
  });

  it("rejects a student as the course owner", async () => {
    prisma.user.findFirst.mockResolvedValueOnce({
      id: validCoursePayload.ownerTeacherId,
      role: UserRole.student,
      status: UserStatus.active,
    });

    await expect(createCourse(validCoursePayload)).rejects.toMatchObject({
      statusCode: 409,
      message: "Course owner must be an active teacher.",
      details: {
        code: "invalid_role_pairing",
        expectedRole: UserRole.teacher,
        actualRole: UserRole.student,
      },
    });

    expect(prisma.course.create).not.toHaveBeenCalled();
  });

  it("rejects a suspended teacher as the course owner", async () => {
    prisma.user.findFirst.mockResolvedValueOnce({
      id: validCoursePayload.ownerTeacherId,
      role: UserRole.teacher,
      status: UserStatus.suspended,
    });

    await expect(createCourse(validCoursePayload)).rejects.toMatchObject({
      statusCode: 409,
      message: "Course owner must be an active teacher.",
      details: {
        code: "invalid_role_pairing",
        expectedStatus: UserStatus.active,
        actualStatus: UserStatus.suspended,
      },
    });

    expect(prisma.course.create).not.toHaveBeenCalled();
  });
});

describe("courses.service course settings mutations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows the course owner to update editable course metadata", async () => {
    const updatedCourse = {
      id: courseId,
      title: "Updated IELTS Writing",
      description: "New cohort settings",
      ownerId,
      learningOutcomes: ["Write clearer task responses"],
      structureSummary: "Two lessons per week",
      prerequisitesSummary: "Band 5.5+",
      scheduleJson: { cadence: "weekly" },
      createdAt: new Date("2026-05-29T00:00:00.000Z"),
      updatedAt: new Date("2026-05-30T00:00:00.000Z"),
      deletedAt: null,
    };
    prisma.course.findFirst.mockResolvedValueOnce({
      id: courseId,
      ownerId,
      deletedAt: null,
    });
    prisma.course.update.mockResolvedValueOnce(updatedCourse);

    const result = await updateCourse(
      { courseId },
      {
        title: updatedCourse.title,
        description: updatedCourse.description,
        learningOutcomes: updatedCourse.learningOutcomes,
        structureSummary: updatedCourse.structureSummary,
        prerequisitesSummary: updatedCourse.prerequisitesSummary,
        schedule: updatedCourse.scheduleJson,
      },
      ownerActor,
    );

    expect(prisma.course.update).toHaveBeenCalledWith({
      where: { id: courseId },
      data: {
        title: updatedCourse.title,
        description: updatedCourse.description,
        learningOutcomes: updatedCourse.learningOutcomes,
        structureSummary: updatedCourse.structureSummary,
        prerequisitesSummary: updatedCourse.prerequisitesSummary,
        scheduleJson: updatedCourse.scheduleJson,
      },
    });
    expect(writeAuditLogSafely).toHaveBeenCalledWith({
      actorId: ownerActor.id,
      action: "course.updated",
      entity: "course",
      entityId: courseId,
      before: {
        id: courseId,
        ownerId,
        deletedAt: null,
      },
      after: updatedCourse,
      diff: {
        title: updatedCourse.title,
        description: updatedCourse.description,
        learningOutcomes: updatedCourse.learningOutcomes,
        structureSummary: updatedCourse.structureSummary,
        prerequisitesSummary: updatedCourse.prerequisitesSummary,
        schedule: updatedCourse.scheduleJson,
      },
    });
    expect(result).toBe(updatedCourse);
  });

  it("allows admins to archive and restore a course", async () => {
    const archivedAt = new Date("2026-05-30T00:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(archivedAt);
    prisma.course.findFirst
      .mockResolvedValueOnce({ id: courseId, ownerId, deletedAt: null })
      .mockResolvedValueOnce({ id: courseId, ownerId, deletedAt: archivedAt });
    prisma.course.update
      .mockResolvedValueOnce({ id: courseId, ownerId, deletedAt: archivedAt })
      .mockResolvedValueOnce({ id: courseId, ownerId, deletedAt: null });

    await archiveCourse({ courseId }, adminActor);
    await restoreCourse({ courseId }, adminActor);

    expect(prisma.course.update).toHaveBeenNthCalledWith(1, {
      where: { id: courseId },
      data: { deletedAt: archivedAt },
    });
    expect(prisma.course.update).toHaveBeenNthCalledWith(2, {
      where: { id: courseId },
      data: { deletedAt: null },
    });
    expect(writeAuditLogSafely).toHaveBeenNthCalledWith(1, {
      actorId: adminActor.id,
      action: "course.archived",
      entity: "course",
      entityId: courseId,
      before: { id: courseId, ownerId, deletedAt: null },
      after: { id: courseId, ownerId, deletedAt: archivedAt },
      diff: { deletedAt: archivedAt },
    });
    expect(writeAuditLogSafely).toHaveBeenNthCalledWith(2, {
      actorId: adminActor.id,
      action: "course.restored",
      entity: "course",
      entityId: courseId,
      before: { id: courseId, ownerId, deletedAt: archivedAt },
      after: { id: courseId, ownerId, deletedAt: null },
      diff: { deletedAt: null },
    });

    vi.useRealTimers();
  });

  it("rejects students mutating course settings", async () => {
    prisma.course.findFirst.mockResolvedValueOnce({
      id: courseId,
      ownerId,
      deletedAt: null,
    });

    await expect(
      updateCourse({ courseId }, { title: "Nope" }, studentActor),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: "You do not have permission to manage this course",
    });

    expect(prisma.course.update).not.toHaveBeenCalled();
  });
});
