/**
 * File: tests/modules/submissions/submissions.service.test.ts
 * Purpose: Validate IELTS submission payload handling in the service layer.
 * Why: Ensures valid payloads persist once assignment types are verified.
 */
import { describe, expect, it, beforeEach, vi } from "vitest";
import type { Assignment, Submission } from '../../../src/prisma/index.js';

vi.mock("../../../src/prisma/client.js", () => ({
  prisma: {
    assignment: {
      findFirst: vi.fn(),
    },
    enrollment: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    submission: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));
vi.mock("../../../src/modules/scoring/ieltsScoring.service.js", () => ({
  autoScoreSubmission: vi.fn(),
}));
vi.mock(
  "../../../src/modules/notification-preferences/notification-preferences.service.js",
  () => ({
    resolveNotificationTypeEnabledForUsers: vi.fn(),
  }),
);
vi.mock("../../../src/modules/notifications/notifications.service.js", () => ({
  enqueueNotification: vi.fn(),
}));

const prismaModule = await import("../../../src/prisma/client.js");
const prisma = vi.mocked(prismaModule.prisma, true);
const notificationPreferencesModule = await import(
  "../../../src/modules/notification-preferences/notification-preferences.service.js"
);
const notificationsModule = await import(
  "../../../src/modules/notifications/notifications.service.js"
);
const resolveNotificationTypeEnabledForUsers = vi.mocked(
  notificationPreferencesModule.resolveNotificationTypeEnabledForUsers,
  true,
);
const enqueueNotification = vi.mocked(
  notificationsModule.enqueueNotification,
  true,
);

const { createSubmission, listSubmissions } = await import(
  "../../../src/modules/submissions/submissions.service.js"
);
const { createSubmissionSchema } = await import(
  "../../../src/modules/submissions/submissions.schema.js"
);

const assignmentId = "4c67e29f-7a7b-4c3e-8d56-52e5487e59a1";
const studentId = "b9a2031b-9eac-4c77-9f11-4e7fbf3b5c2b";

describe("submissions.service.createSubmission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.enrollment.findFirst.mockResolvedValue({
      id: "a0c0fb2e-f9ef-4b4c-8c7e-69235fd247c8",
    });
    prisma.enrollment.findMany.mockResolvedValue([]);
    resolveNotificationTypeEnabledForUsers.mockResolvedValue(new Map());
  });

  it("persists valid IELTS submission payloads for the authenticated student", async () => {
    const assignmentRecord: Assignment = {
      id: assignmentId,
      courseId: "8a7c1b41-2a1c-4f6d-9f6d-3f2a0e8e2c15",
      title: "Reading Practice",
      description: null,
      type: "reading",
      dueAt: null,
      latePolicy: null,
      assignmentConfig: null,
      publishedAt: new Date("2026-01-01T00:00:00.000Z"),
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      deletedAt: null,
    };

    prisma.assignment.findFirst.mockResolvedValueOnce(assignmentRecord);
    prisma.submission.findUnique.mockResolvedValueOnce(null);
    const record = { id: "submission-1" } as Submission;
    prisma.submission.create.mockResolvedValueOnce(record);

    const payload = {
      payload: {
        version: 1,
        answers: [{ questionId: "q1", value: "A" }],
      },
    };

    const result = await createSubmission(
      { assignmentId },
      payload,
      { id: studentId, role: "student" },
    );

    expect(prisma.submission.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          assignmentId,
          studentId,
          status: "draft",
          payload: expect.objectContaining({
            version: 1,
          }),
        }),
      }),
    );
    expect(result).toBe(record);
  });

  it("does not create submissions for assignments in archived courses", async () => {
    prisma.assignment.findFirst.mockImplementationOnce(async (args) =>
      args?.where?.course?.deletedAt === null ? null : ({} as Assignment),
    );

    await expect(
      createSubmission(
        { assignmentId },
        {
          payload: {
            version: 1,
            answers: [{ questionId: "q1", value: "A" }],
          },
        },
        { id: studentId, role: "student" },
      ),
    ).rejects.toMatchObject({ statusCode: 404 });

    expect(prisma.submission.create).not.toHaveBeenCalled();
  });

  it("lists submissions only for assignments in active courses", async () => {
    prisma.submission.findMany.mockResolvedValueOnce([]);

    await listSubmissions({ assignmentId }, {}, { id: studentId, role: "student" });

    expect(prisma.submission.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          assignment: {
            course: {
              deletedAt: null,
            },
          },
        }),
      }),
    );
  });

  it("rejects client-supplied student identity fields", () => {
    expect(() =>
      createSubmissionSchema.parse({
        studentId: "b5eb3d3c-b13f-4b3b-a93f-910fbb2a3c13",
        payload: {
          version: 1,
          answers: [{ questionId: "q1", value: "A" }],
        },
      }),
    ).toThrow();
  });

  it("auto-submits when the time limit is exceeded", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-02T01:00:00.000Z"));

    const assignmentRecord: Assignment = {
      id: assignmentId,
      courseId: "8a7c1b41-2a1c-4f6d-9f6d-3f2a0e8e2c15",
      title: "Reading Practice",
      description: null,
      type: "reading",
      dueAt: null,
      latePolicy: null,
      assignmentConfig: {
        version: 1,
        timing: {
          enabled: true,
          durationMinutes: 30,
          enforce: true,
          autoSubmit: true,
        },
        attempts: { maxAttempts: null },
        sections: [],
      },
      publishedAt: new Date("2026-01-01T00:00:00.000Z"),
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      deletedAt: null,
    };

    prisma.assignment.findFirst.mockResolvedValueOnce(assignmentRecord);
    prisma.submission.findUnique.mockResolvedValueOnce(null);
    const record = { id: "submission-2" } as Submission;
    prisma.submission.create.mockResolvedValueOnce(record);

    const payload = {
      payload: {
        version: 1,
        startedAt: "2026-01-02T00:00:00.000Z",
        answers: [{ questionId: "q1", value: "A" }],
      },
    };

    await createSubmission(
      { assignmentId },
      payload,
      { id: studentId, role: "student" },
    );

    expect(prisma.submission.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "submitted",
          submittedAt: expect.any(Date),
        }),
      }),
    );

    vi.useRealTimers();
  });

  it("rejects submissions beyond max attempts", async () => {
    const assignmentRecord: Assignment = {
      id: assignmentId,
      courseId: "8a7c1b41-2a1c-4f6d-9f6d-3f2a0e8e2c15",
      title: "Reading Practice",
      description: null,
      type: "reading",
      dueAt: null,
      latePolicy: null,
      assignmentConfig: {
        version: 1,
        timing: { enabled: true, durationMinutes: 30, enforce: false },
        attempts: { maxAttempts: 1 },
        sections: [],
      },
      publishedAt: new Date("2026-01-01T00:00:00.000Z"),
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      deletedAt: null,
    };

    prisma.assignment.findFirst.mockResolvedValueOnce(assignmentRecord);
    prisma.submission.findUnique.mockResolvedValueOnce({
      id: "submission-3",
      status: "submitted",
      payload: { version: 1 },
    } as Submission);

    const payload = {
      payload: {
        version: 1,
        answers: [{ questionId: "q1", value: "A" }],
      },
    };

    await expect(
      createSubmission(
        { assignmentId },
        payload,
        { id: studentId, role: "student" },
      ),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("rejects submitted IELTS speaking payloads without recording metadata", async () => {
    const assignmentRecord: Assignment = {
      id: assignmentId,
      courseId: "8a7c1b41-2a1c-4f6d-9f6d-3f2a0e8e2c15",
      title: "Speaking Practice",
      description: null,
      type: "speaking",
      dueAt: null,
      latePolicy: null,
      assignmentConfig: {
        version: 1,
        timing: { enabled: false, durationMinutes: 15, enforce: false },
        attempts: { maxAttempts: null },
        part1: { questions: ["Where do you live?"] },
        part2: {
          cueCard: {
            topic: "Describe a useful object.",
            bulletPoints: ["what it is"],
          },
          prepSeconds: 60,
          talkSeconds: 120,
        },
        part3: { questions: ["How has technology changed daily life?"] },
      },
      publishedAt: new Date("2026-01-01T00:00:00.000Z"),
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      deletedAt: null,
    };

    prisma.assignment.findFirst.mockResolvedValueOnce(assignmentRecord);
    prisma.submission.findUnique.mockResolvedValueOnce(null);

    await expect(
      createSubmission(
        { assignmentId },
        {
          submittedAt: "2026-01-02T00:00:00.000Z",
          status: "submitted",
          payload: {
            version: 1,
            recordings: [],
          },
        },
        { id: studentId, role: "student" },
      ),
    ).rejects.toMatchObject({ statusCode: 400 });

    expect(prisma.submission.create).not.toHaveBeenCalled();
  });

  it("enqueues teacher notifications only for enabled teachers on submission", async () => {
    const assignmentRecord = {
      id: assignmentId,
      courseId: "course-1",
      title: "Reading Practice",
      type: "reading",
      assignmentConfig: null,
      dueAt: null,
      latePolicy: null,
      publishedAt: new Date("2026-02-01T00:00:00.000Z"),
      course: {
        title: "IELTS Reading",
      },
    };

    prisma.assignment.findFirst.mockResolvedValueOnce(assignmentRecord);
    prisma.submission.findUnique.mockResolvedValueOnce(null);
    prisma.enrollment.findMany.mockResolvedValueOnce([
      { userId: "teacher-1" },
      { userId: "teacher-2" },
      { userId: "teacher-1" },
    ]);
    resolveNotificationTypeEnabledForUsers.mockResolvedValueOnce(
      new Map([
        ["teacher-1", true],
        ["teacher-2", false],
      ]),
    );
    prisma.submission.create.mockResolvedValueOnce({
      id: "submission-4",
      submittedAt: new Date("2026-02-09T10:00:00.000Z"),
    } as Submission);

    await createSubmission(
      { assignmentId },
      {
        submittedAt: "2026-02-09T10:00:00.000Z",
        payload: {
          version: 1,
          answers: [{ questionId: "q1", value: "A" }],
        },
      },
      { id: studentId, role: "student" },
    );

    expect(resolveNotificationTypeEnabledForUsers).toHaveBeenCalledWith({
      role: "teacher",
      type: "new_submission",
      userIds: ["teacher-1", "teacher-2"],
    });
    expect(enqueueNotification).toHaveBeenCalledTimes(1);
    expect(enqueueNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "teacher-1",
        type: "new_submission",
      }),
    );
  });
});
