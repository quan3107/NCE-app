/**
 * File: tests/modules/grades/grades.service.test.ts
 * Purpose: Verify grade writes derive grader identity from authenticated actors.
 * Why: Prevents clients from spoofing grading ownership or grading outside-course submissions.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AssignmentType,
  EnrollmentRole,
  UserRole,
} from "../../../src/prisma/index.js";

vi.mock("../../../src/prisma/client.js", () => ({
  prisma: {
    submission: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    grade: {
      findFirst: vi.fn(),
      upsert: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("../../../src/modules/notifications/notifications.service.js", () => ({
  enqueueNotification: vi.fn(),
}));

vi.mock("../../../src/modules/ai-feedback/ai-feedback.repository.js", () => ({
  getStudentVisibleAiFeedbackDraft: vi.fn(),
}));
vi.mock("../../../src/modules/audit-logs/audit-logs.service.js", () => ({
  writeAuditLogSafely: vi.fn(),
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
const aiFeedbackRepositoryModule = await import(
  "../../../src/modules/ai-feedback/ai-feedback.repository.js"
);
const getStudentVisibleAiFeedbackDraft = vi.mocked(
  aiFeedbackRepositoryModule.getStudentVisibleAiFeedbackDraft,
);
const auditLogsModule = await import(
  "../../../src/modules/audit-logs/audit-logs.service.js"
);
const writeAuditLogSafely = vi.mocked(
  auditLogsModule.writeAuditLogSafely,
  true,
);

const { getGrade, upsertGrade } = await import(
  "../../../src/modules/grades/grades.service.js"
);
const { gradePayloadSchema } = await import(
  "../../../src/modules/grades/grades.schema.js"
);

const submissionId = "2520f0dd-918a-4c2b-9544-b922eac066e5";
const teacherId = "db2b572b-ef7d-44b3-96c6-a61c498cf673";
const adminId = "d5ef35a6-6907-47e8-9c34-5849656d827f";
const studentId = "4335e34e-7ecb-4a31-ae53-b04c44cd7c09";
const otherStudentId = "153c2d0e-1b97-47c5-9644-5d2f2fd52929";

function buildSubmission(overrides: Record<string, unknown> = {}) {
  return {
    id: submissionId,
    assignment: {
      id: "7a7510e2-5fac-46e6-a2d1-6d30c87bcc0c",
      title: "Writing Task",
      type: AssignmentType.text,
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

  it("writes a grade.upserted audit log with grading fields", async () => {
    prisma.submission.findFirst.mockResolvedValueOnce(buildSubmission() as never);
    prisma.grade.upsert.mockResolvedValueOnce({
      id: "grade-audit-1",
      submissionId,
      graderId: teacherId,
      rawScore: 6,
      finalScore: 7,
      band: 7,
    } as never);

    await upsertGrade(
      { submissionId },
      {
        rawScore: 6,
        finalScore: 7,
        band: 7,
        feedbackMd: "Detailed private feedback.",
      },
      { id: teacherId, role: UserRole.teacher },
    );

    expect(writeAuditLogSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: teacherId,
        action: "grade.upserted",
        entity: "grade",
        entityId: "grade-audit-1",
        diff: expect.objectContaining({
          submissionId,
          graderId: teacherId,
          rawScore: 6,
          finalScore: 7,
          band: 7,
          feedbackMd: "Detailed private feedback.",
        }),
      }),
    );
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

  it("derives IELTS writing band grades from valid criterion breakdowns", async () => {
    prisma.submission.findFirst.mockResolvedValueOnce(
      buildSubmission({
        assignment: {
          id: "7a7510e2-5fac-46e6-a2d1-6d30c87bcc0c",
          title: "Writing Task 2",
          type: AssignmentType.writing,
          courseId: "87ab2f6a-016b-4f4d-ab68-bc574ae3a660",
          course: {
            title: "IELTS Writing",
            ownerId: teacherId,
            enrollments: [],
          },
        },
      }) as never,
    );

    await upsertGrade(
      { submissionId },
      {
        rubricBreakdown: [
          { criterion: "Task Response", points: 6.5 },
          { criterion: "Coherence and Cohesion", points: 7 },
          { criterion: "Lexical Resource", points: 7.5 },
          { criterion: "Grammatical Range and Accuracy", points: 6.5 },
        ],
        finalScore: 1,
        band: 1,
        feedbackMd: "Clear response with occasional grammar issues.",
      },
      { id: teacherId, role: UserRole.teacher },
    );

    expect(prisma.grade.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          rubricBreakdown: [
            { criterion: "Task Response", points: 6.5 },
            { criterion: "Coherence and Cohesion", points: 7 },
            { criterion: "Lexical Resource", points: 7.5 },
            { criterion: "Grammatical Range and Accuracy", points: 6.5 },
          ],
          rawScore: 7,
          finalScore: 7,
          band: 7,
          feedback: "Clear response with occasional grammar issues.",
        }),
      }),
    );
  });

  it("derives IELTS writing band grades from task-specific criterion breakdowns", async () => {
    prisma.submission.findFirst.mockResolvedValueOnce(
      buildSubmission({
        assignment: {
          id: "7a7510e2-5fac-46e6-a2d1-6d30c87bcc0c",
          title: "Writing Full Test",
          type: AssignmentType.writing,
          courseId: "87ab2f6a-016b-4f4d-ab68-bc574ae3a660",
          course: {
            title: "IELTS Writing",
            ownerId: teacherId,
            enrollments: [],
          },
        },
      }) as never,
    );

    await upsertGrade(
      { submissionId },
      {
        rubricBreakdown: [
          { criterion: "Task 1 - Task Achievement", points: 6 },
          { criterion: "Task 1 - Coherence and Cohesion", points: 6.5 },
          { criterion: "Task 1 - Lexical Resource", points: 6.5 },
          {
            criterion: "Task 1 - Grammatical Range and Accuracy",
            points: 6,
          },
          { criterion: "Task 2 - Task Response", points: 7 },
          { criterion: "Task 2 - Coherence and Cohesion", points: 7 },
          { criterion: "Task 2 - Lexical Resource", points: 7.5 },
          {
            criterion: "Task 2 - Grammatical Range and Accuracy",
            points: 7,
          },
        ],
      },
      { id: teacherId, role: UserRole.teacher },
    );

    expect(prisma.grade.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          band: 7,
          finalScore: 7,
          rawScore: 7,
        }),
      }),
    );
  });

  it("rejects IELTS writing grades with non-half-step bands", async () => {
    prisma.submission.findFirst.mockResolvedValueOnce(
      buildSubmission({
        assignment: {
          id: "7a7510e2-5fac-46e6-a2d1-6d30c87bcc0c",
          title: "Writing Task 1",
          type: AssignmentType.writing,
          courseId: "87ab2f6a-016b-4f4d-ab68-bc574ae3a660",
          course: {
            title: "IELTS Writing",
            ownerId: teacherId,
            enrollments: [],
          },
        },
      }) as never,
    );

    await expect(
      upsertGrade(
        { submissionId },
        {
          rubricBreakdown: [
            { criterion: "Task Achievement", points: 6.25 },
            { criterion: "Coherence and Cohesion", points: 7 },
            { criterion: "Lexical Resource", points: 7 },
            { criterion: "Grammatical Range and Accuracy", points: 7 },
          ],
        },
        { id: teacherId, role: UserRole.teacher },
      ),
    ).rejects.toThrow(/0\.5 increments/);

    expect(prisma.grade.upsert).not.toHaveBeenCalled();
  });

  it("rejects IELTS speaking grades with non-speaking criteria", async () => {
    prisma.submission.findFirst.mockResolvedValueOnce(
      buildSubmission({
        assignment: {
          id: "7a7510e2-5fac-46e6-a2d1-6d30c87bcc0c",
          title: "Speaking Interview",
          type: AssignmentType.speaking,
          courseId: "87ab2f6a-016b-4f4d-ab68-bc574ae3a660",
          course: {
            title: "IELTS Speaking",
            ownerId: teacherId,
            enrollments: [],
          },
        },
      }) as never,
    );

    await expect(
      upsertGrade(
        { submissionId },
        {
          rubricBreakdown: [
            { criterion: "Task Response", points: 7 },
            { criterion: "Coherence and Cohesion", points: 7 },
            { criterion: "Lexical Resource", points: 7 },
            { criterion: "Grammatical Range and Accuracy", points: 7 },
          ],
        },
        { id: teacherId, role: UserRole.teacher },
      ),
    ).rejects.toThrow(/IELTS speaking criteria/);

    expect(prisma.grade.upsert).not.toHaveBeenCalled();
  });
});

describe("grades.service.getGrade", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getStudentVisibleAiFeedbackDraft.mockResolvedValue(null as never);
  });

  it("allows students to read grades for their own active submissions", async () => {
    const gradeRecord = {
      id: "b82c0f6c-73ac-4c42-bc4f-a6c2d507f612",
      submissionId,
      graderId: teacherId,
      grader: {
        fullName: "Teacher One",
      },
      aiFeedbackDrafts: [],
    };
    prisma.grade.findFirst.mockResolvedValueOnce(gradeRecord as never);

    const grade = await getGrade(
      { submissionId },
      { id: studentId, role: UserRole.student },
    );

    expect(prisma.grade.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          submissionId,
          deletedAt: null,
          submission: expect.objectContaining({
            studentId,
            deletedAt: null,
            assignment: {
              deletedAt: null,
              course: {
                deletedAt: null,
              },
            },
          }),
        }),
        include: {
          grader: {
            select: {
              fullName: true,
            },
          },
          aiFeedbackDrafts: expect.any(Object),
        },
      }),
    );
    expect(getStudentVisibleAiFeedbackDraft).toHaveBeenCalledWith({
      submissionId,
      studentId,
    });
    expect(grade).toEqual(
      expect.objectContaining({
        id: gradeRecord.id,
        graderName: "Teacher One",
        feedbackLabel: "teacher feedback",
      }),
    );
  });

  it("adds sanitized provisional AI writing feedback to student grade responses", async () => {
    prisma.grade.findFirst.mockResolvedValueOnce({
      id: "grade-with-ai",
      submissionId,
      graderId: teacherId,
      feedback: null,
      grader: {
        fullName: "Teacher One",
      },
      aiFeedbackDrafts: [],
    } as never);
    getStudentVisibleAiFeedbackDraft.mockResolvedValueOnce({
      id: "draft-1",
      status: "accepted",
      visibilityMode: "instant_student_visible",
      generatedFeedback: {
        feedbackMd: "Strong overview; add sharper evidence.",
        provider: "hidden-provider",
        prompt: "hidden prompt",
      },
      model: "hidden-model",
      promptVersion: "hidden-version",
    } as never);

    const grade = await getGrade(
      { submissionId },
      { id: studentId, role: UserRole.student },
    );

    expect(grade).toEqual(
      expect.objectContaining({
        studentAiFeedback: {
          label: "provisional AI feedback",
          status: "accepted",
          feedback: {
            feedbackMd: "Strong overview; add sharper evidence.",
          },
        },
      }),
    );
    expect(JSON.stringify(grade)).not.toContain("hidden-provider");
    expect(JSON.stringify(grade)).not.toContain("hidden-model");
    expect(JSON.stringify(grade)).not.toContain("hidden prompt");
  });

  it("returns provisional instant-visible AI feedback before a grade exists", async () => {
    prisma.grade.findFirst.mockResolvedValueOnce(null);
    getStudentVisibleAiFeedbackDraft.mockResolvedValueOnce({
      id: "draft-before-grade",
      submissionId,
      status: "accepted",
      visibilityMode: "instant_student_visible",
      generatedFeedback: {
        feedbackMd: "This provisional feedback is ready before teacher grading.",
      },
    } as never);

    const grade = await getGrade(
      { submissionId },
      { id: studentId, role: UserRole.student },
    );

    expect(grade).toEqual(
      expect.objectContaining({
        id: "draft-before-grade",
        submissionId,
        provisionalOnly: true,
        feedbackLabel: "teacher feedback",
        studentAiFeedback: {
          label: "provisional AI feedback",
          status: "accepted",
          feedback: {
            feedbackMd:
              "This provisional feedback is ready before teacher grading.",
          },
        },
      }),
    );
  });

  it("labels grade feedback that came from teacher-reviewed AI assistance", async () => {
    prisma.grade.findFirst.mockResolvedValueOnce({
      id: "grade-ai-assisted",
      submissionId,
      graderId: teacherId,
      feedback: "Teacher-edited AI feedback.",
      grader: {
        fullName: "Teacher One",
      },
      aiFeedbackDrafts: [
        {
          id: "draft-2",
          status: "approved",
          visibilityMode: "teacher_reviewed",
        },
      ],
    } as never);

    const grade = await getGrade(
      { submissionId },
      { id: studentId, role: UserRole.student },
    );

    expect(grade).toEqual(
      expect.objectContaining({
        feedback: "Teacher-edited AI feedback.",
        feedbackLabel: "teacher-reviewed AI-assisted feedback",
      }),
    );
  });

  it("does not expose another student's grade to students", async () => {
    prisma.grade.findFirst.mockResolvedValueOnce(null);

    await expect(
      getGrade(
        { submissionId },
        { id: otherStudentId, role: UserRole.student },
      ),
    ).rejects.toMatchObject({ statusCode: 404 });

    expect(prisma.grade.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          submission: expect.objectContaining({
            studentId: otherStudentId,
          }),
        }),
      }),
    );
  });

  it("allows course teachers to read grades for submissions in their courses", async () => {
    prisma.grade.findFirst.mockResolvedValueOnce({
      id: "grade-2",
      submissionId,
      graderId: teacherId,
      grader: {
        fullName: "Teacher One",
      },
    } as never);

    await getGrade(
      { submissionId },
      { id: teacherId, role: UserRole.teacher },
    );

    expect(prisma.grade.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          submission: expect.objectContaining({
            assignment: {
              deletedAt: null,
              course: {
                deletedAt: null,
                OR: [
                  { ownerId: teacherId },
                  {
                    enrollments: {
                      some: {
                        userId: teacherId,
                        roleInCourse: EnrollmentRole.teacher,
                        deletedAt: null,
                      },
                    },
                  },
                ],
              },
            },
          }),
        }),
      }),
    );
  });

  it("allows admins to read active grades without course ownership filters", async () => {
    prisma.grade.findFirst.mockResolvedValueOnce({
      id: "grade-3",
      submissionId,
      graderId: teacherId,
      grader: {
        fullName: "Teacher One",
      },
    } as never);

    await getGrade(
      { submissionId },
      { id: adminId, role: UserRole.admin },
    );

    expect(prisma.grade.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          submissionId,
          deletedAt: null,
          submission: {
            deletedAt: null,
            assignment: {
              deletedAt: null,
              course: {
                deletedAt: null,
              },
            },
          },
        },
      }),
    );
  });
});
