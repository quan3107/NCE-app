/**
 * File: tests/modules/grades/grades.service.test.ts
 * Purpose: Verify grade writes derive grader identity from authenticated actors.
 * Why: Prevents clients from spoofing grading ownership or grading outside-course submissions.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EnrollmentRole, UserRole } from "../../../src/prisma/index.js";

vi.mock("../../../src/prisma/client.js", () => ({
  prisma: {
    submission: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    grade: {
      upsert: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("../../../src/modules/notifications/notifications.service.js", () => ({
  enqueueNotification: vi.fn(),
}));

const prismaModule = await import("../../../src/prisma/client.js");
const prisma = vi.mocked(prismaModule.prisma, true);
const notificationsModule = await import(
  "../../../src/modules/notifications/notifications.service.js"
);
const enqueueNotification = vi.mocked(
  notificationsModule.enqueueNotification,
  true,
);

const { upsertGrade } = await import(
  "../../../src/modules/grades/grades.service.js"
);
const { gradePayloadSchema } = await import(
  "../../../src/modules/grades/grades.schema.js"
);

const submissionId = "2520f0dd-918a-4c2b-9544-b922eac066e5";
const teacherId = "db2b572b-ef7d-44b3-96c6-a61c498cf673";
const adminId = "d5ef35a6-6907-47e8-9c34-5849656d827f";
const studentId = "4335e34e-7ecb-4a31-ae53-b04c44cd7c09";

function buildSubmission(overrides: Record<string, unknown> = {}) {
  return {
    id: submissionId,
    assignment: {
      id: "7a7510e2-5fac-46e6-a2d1-6d30c87bcc0c",
      title: "Writing Task",
      courseId: "87ab2f6a-016b-4f4d-ab68-bc574ae3a660",
      course: {
        title: "IELTS Writing",
        ownerId: teacherId,
        enrollments: [],
      },
    },
    student: {
      id: studentId,
    },
    ...overrides,
  };
}

describe("grades.service.upsertGrade", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.grade.upsert.mockResolvedValue({ id: "grade-1" } as never);
    prisma.submission.update.mockResolvedValue({ id: submissionId } as never);
    prisma.$transaction.mockImplementation(async (operations) =>
      Promise.all(operations),
    );
  });

  it("persists the authenticated teacher as grader without a graderId payload", async () => {
    prisma.submission.findFirst.mockResolvedValueOnce(buildSubmission() as never);

    const grade = await upsertGrade(
      { submissionId },
      {
        finalScore: 7,
        feedbackMd: "Clear organization.",
      },
      { id: teacherId, role: UserRole.teacher },
    );

    expect(prisma.grade.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          submissionId,
          graderId: teacherId,
          finalScore: 7,
          feedback: "Clear organization.",
        }),
        update: expect.objectContaining({
          graderId: teacherId,
          finalScore: 7,
          feedback: "Clear organization.",
        }),
      }),
    );
    expect(enqueueNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: studentId,
        type: "graded",
      }),
    );
    expect(grade).toEqual({ id: "grade-1" });
  });

  it("loads grade targets only from active assignments and courses", async () => {
    prisma.submission.findFirst.mockResolvedValueOnce(buildSubmission() as never);

    await upsertGrade(
      { submissionId },
      { finalScore: 7 },
      { id: teacherId, role: UserRole.teacher },
    );

    expect(prisma.submission.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: submissionId,
          deletedAt: null,
          assignment: {
            deletedAt: null,
            course: {
              deletedAt: null,
            },
          },
        },
      }),
    );
  });

  it("rejects client-supplied grader identity fields", () => {
    expect(() =>
      gradePayloadSchema.parse({
        graderId: "7498e33b-e545-40c1-9bc4-64167065dd73",
        finalScore: 7,
      }),
    ).toThrow();
  });

  it("persists an authenticated admin as grader", async () => {
    prisma.submission.findFirst.mockResolvedValueOnce(buildSubmission() as never);

    await upsertGrade(
      { submissionId },
      { finalScore: 8 },
      { id: adminId, role: UserRole.admin },
    );

    expect(prisma.grade.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          graderId: adminId,
        }),
        update: expect.objectContaining({
          graderId: adminId,
        }),
      }),
    );
  });

  it("allows enrolled co-teachers to grade", async () => {
    const coTeacherId = "e7e2ca20-84b8-492a-bb63-c567d26daf13";
    prisma.submission.findFirst.mockResolvedValueOnce(
      buildSubmission({
        assignment: {
          id: "7a7510e2-5fac-46e6-a2d1-6d30c87bcc0c",
          title: "Writing Task",
          courseId: "87ab2f6a-016b-4f4d-ab68-bc574ae3a660",
          course: {
            title: "IELTS Writing",
            ownerId: teacherId,
            enrollments: [
              {
                userId: coTeacherId,
                roleInCourse: EnrollmentRole.teacher,
                deletedAt: null,
              },
            ],
          },
        },
      }) as never,
    );

    await upsertGrade(
      { submissionId },
      { finalScore: 7 },
      { id: coTeacherId, role: UserRole.teacher },
    );

    expect(prisma.grade.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          graderId: coTeacherId,
        }),
      }),
    );
  });

  it("rejects outside-course teachers", async () => {
    prisma.submission.findFirst.mockResolvedValueOnce(buildSubmission() as never);

    await expect(
      upsertGrade(
        { submissionId },
        { finalScore: 7 },
        {
          id: "a5e5e576-db88-49b9-a301-a7db36b1d195",
          role: UserRole.teacher,
        },
      ),
    ).rejects.toMatchObject({ statusCode: 403 });

    expect(prisma.grade.upsert).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
