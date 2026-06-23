/**
 * File: tests/modules/nce-attempts/nce-attempts.service.test.ts
 * Purpose: Verify student NCE lesson progress and exercise attempt behavior.
 * Why: Protects enrollment, ownership, draft persistence, scoring, and teacher summaries.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  EnrollmentRole,
  NceAttemptStatus,
  NceExerciseType,
  NceLessonProgressStatus,
  NcePublishStatus,
  UserRole,
  UserStatus,
  type Prisma,
} from "../../../src/prisma/index.js";

vi.mock("../../../src/config/prismaClient.js", () => ({
  prisma: {
    course: {
      findFirst: vi.fn(),
    },
    nceCourseLessonAssignment: {
      count: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    nceExercise: {
      findFirst: vi.fn(),
    },
    nceExerciseAttempt: {
      count: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    nceLessonProgress: {
      upsert: vi.fn(),
    },
  },
  runWithRole: vi.fn(async (_options, read) => read()),
}));

const prismaModule = await import("../../../src/config/prismaClient.js");
const prisma = vi.mocked(prismaModule.prisma, true);

const {
  completeNceLesson,
  createOrUpdateNceAttempt,
  listStudentNcePath,
  listTeacherNceAttemptSummaries,
  submitNceAttempt,
} = await import("../../../src/modules/nce-attempts/nce-attempts.service.js");

const courseId = "11111111-1111-4111-8111-111111111111";
const lessonId = "22222222-2222-4222-8222-222222222222";
const exerciseId = "33333333-3333-4333-8333-333333333333";
const attemptId = "44444444-4444-4444-8444-444444444444";
const studentId = "55555555-5555-4555-8555-555555555555";
const teacherId = "66666666-6666-4666-8666-666666666666";
const otherStudentId = "77777777-7777-4777-8777-777777777777";
const now = new Date("2026-06-23T10:00:00.000Z");

const studentActor = {
  id: studentId,
  role: UserRole.student,
  status: UserStatus.active,
};
const otherStudentActor = {
  id: otherStudentId,
  role: UserRole.student,
  status: UserStatus.active,
};
const teacherActor = {
  id: teacherId,
  role: UserRole.teacher,
  status: UserStatus.active,
};

const course = {
  id: courseId,
  ownerId: teacherId,
  enrollments: [
    {
      userId: studentId,
      roleInCourse: EnrollmentRole.student,
      deletedAt: null,
      user: { deletedAt: null, status: UserStatus.active },
    },
  ],
};

const lessonAssignment = {
  courseId,
  lessonId,
  sequence: 1,
  availableFrom: null,
  dueAt: null,
  lesson: {
    id: lessonId,
    unitId: "88888888-8888-4888-8888-888888888888",
    lessonNumber: 1,
    title: "Excuse me!",
    lessonText: "Excuse me! Is this your handbag?",
    mediaJson: null as Prisma.JsonValue,
    teacherNotes: null,
    sortOrder: 1,
    status: NcePublishStatus.published,
    publishedAt: now,
    createdAt: now,
    updatedAt: now,
    objectives: [],
    exercises: [],
    progress: [
      {
        status: NceLessonProgressStatus.completed,
        startedAt: now,
        completedAt: now,
        updatedAt: now,
      },
    ],
    unit: {
      id: "88888888-8888-4888-8888-888888888888",
      bookId: "99999999-9999-4999-8999-999999999999",
      unitNumber: 1,
      title: "First Things First",
      status: NcePublishStatus.published,
      book: {
        id: "99999999-9999-4999-8999-999999999999",
        code: "nce-1",
        title: "New Concept English Book 1",
        level: "beginner",
        status: NcePublishStatus.published,
      },
    },
  },
};

const exercise = {
  id: exerciseId,
  lessonId,
  objectiveId: null,
  exerciseType: NceExerciseType.gap_fill,
  prompt: "Complete the sentence.",
  content: { sentence: "Is ___ your handbag?" } as Prisma.JsonValue,
  answerKey: { answers: ["this"] } as Prisma.JsonValue,
  scoringConfig: { points: 1 } as Prisma.JsonValue,
  sortOrder: 1,
  lesson: {
    id: lessonId,
    status: NcePublishStatus.published,
    courseAssignments: [{ courseId }],
  },
};

const draftAttempt = {
  id: attemptId,
  courseId,
  lessonId,
  exerciseId,
  studentId,
  status: NceAttemptStatus.draft,
  response: { answer: "this" } as Prisma.JsonValue,
  score: null,
  maxScore: null,
  feedbackJson: null as Prisma.JsonValue,
  submittedAt: null,
  createdAt: now,
  updatedAt: now,
  exercise,
};

describe("nce-attempts.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns assigned published lessons with the student's progress state", async () => {
    prisma.course.findFirst.mockResolvedValueOnce(course);
    prisma.nceCourseLessonAssignment.findMany.mockResolvedValueOnce([
      lessonAssignment,
    ]);
    prisma.nceCourseLessonAssignment.count.mockResolvedValueOnce(1);

    const result = await listStudentNcePath({ courseId }, studentActor, {});

    expect(prisma.course.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: courseId, deletedAt: null },
      }),
    );
    expect(prisma.nceCourseLessonAssignment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          courseId,
          lesson: expect.objectContaining({
            status: NcePublishStatus.published,
          }),
        }),
      }),
    );
    expect(result.lessons[0]).toMatchObject({
      id: lessonId,
      sequence: 1,
      progress: {
        status: NceLessonProgressStatus.completed,
        completedAt: now.toISOString(),
      },
    });
  });

  it("does not list lessons before their available date", async () => {
    prisma.course.findFirst.mockResolvedValueOnce(course);
    prisma.nceCourseLessonAssignment.findMany.mockResolvedValueOnce([]);
    prisma.nceCourseLessonAssignment.count.mockResolvedValueOnce(0);

    await listStudentNcePath({ courseId }, studentActor, {});

    expect(prisma.nceCourseLessonAssignment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { availableFrom: null },
            { availableFrom: { lte: expect.any(Date) } },
          ],
        }),
      }),
    );
    expect(prisma.nceCourseLessonAssignment.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        OR: [
          { availableFrom: null },
          { availableFrom: { lte: expect.any(Date) } },
        ],
      }),
    });
  });

  it("returns the student's latest attempt with each path exercise", async () => {
    prisma.course.findFirst.mockResolvedValueOnce(course);
    prisma.nceCourseLessonAssignment.findMany.mockResolvedValueOnce([
      {
        ...lessonAssignment,
        lesson: {
          ...lessonAssignment.lesson,
          exercises: [
            {
              ...exercise,
              attempts: [draftAttempt],
            },
          ],
        },
      },
    ]);
    prisma.nceCourseLessonAssignment.count.mockResolvedValueOnce(1);

    const result = await listStudentNcePath({ courseId }, studentActor, {});

    expect(prisma.nceCourseLessonAssignment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          lesson: expect.objectContaining({
            select: expect.objectContaining({
              exercises: expect.objectContaining({
                select: expect.objectContaining({
                  attempts: expect.objectContaining({
                    where: { courseId, studentId },
                    orderBy: { updatedAt: "desc" },
                    take: 1,
                  }),
                }),
              }),
            }),
          }),
        }),
      }),
    );
    expect(result.lessons[0]?.exercises[0]).toMatchObject({
      id: exerciseId,
      latestAttempt: {
        id: attemptId,
        status: NceAttemptStatus.draft,
        response: { answer: "this" },
      },
    });
  });

  it("rejects another student before reading a course path", async () => {
    prisma.course.findFirst.mockResolvedValueOnce(course);

    await expect(
      listStudentNcePath({ courseId }, otherStudentActor, {}),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: "You are not enrolled in this course",
    });
    expect(prisma.nceCourseLessonAssignment.findMany).not.toHaveBeenCalled();
  });

  it("creates a draft attempt for an enrolled student and starts lesson progress", async () => {
    prisma.course.findFirst.mockResolvedValueOnce(course);
    prisma.nceExercise.findFirst.mockResolvedValueOnce(exercise);
    prisma.nceExerciseAttempt.findFirst.mockResolvedValueOnce(null);
    prisma.nceExerciseAttempt.create.mockResolvedValueOnce(draftAttempt);

    const result = await createOrUpdateNceAttempt(
      { courseId, exerciseId },
      { response: { answer: "thi" } },
      studentActor,
    );

    expect(prisma.nceLessonProgress.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          courseId_lessonId_studentId: {
            courseId,
            lessonId,
            studentId,
          },
        },
        create: expect.objectContaining({
          status: NceLessonProgressStatus.in_progress,
        }),
      }),
    );
    expect(prisma.nceExerciseAttempt.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: NceAttemptStatus.draft,
          response: { answer: "thi" },
        }),
      }),
    );
    expect(result.status).toBe(NceAttemptStatus.draft);
  });

  it("rejects draft attempts before the assigned lesson is available", async () => {
    prisma.course.findFirst.mockResolvedValueOnce(course);
    prisma.nceExercise.findFirst.mockResolvedValueOnce(null);

    await expect(
      createOrUpdateNceAttempt(
        { courseId, exerciseId },
        { response: { answer: "this" } },
        studentActor,
      ),
    ).rejects.toMatchObject({
      statusCode: 404,
      message: "NCE exercise not found",
    });

    expect(prisma.nceExercise.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          lesson: expect.objectContaining({
            courseAssignments: {
              some: expect.objectContaining({
                courseId,
                OR: [
                  { availableFrom: null },
                  { availableFrom: { lte: expect.any(Date) } },
                ],
              }),
            },
          }),
        }),
      }),
    );
    expect(prisma.nceExerciseAttempt.create).not.toHaveBeenCalled();
  });

  it("updates the existing draft instead of overwriting submitted attempts", async () => {
    prisma.course.findFirst.mockResolvedValueOnce(course);
    prisma.nceExercise.findFirst.mockResolvedValueOnce(exercise);
    prisma.nceExerciseAttempt.findFirst.mockResolvedValueOnce(draftAttempt);
    prisma.nceExerciseAttempt.update.mockResolvedValueOnce({
      ...draftAttempt,
      response: { answer: "this" },
    });

    await createOrUpdateNceAttempt(
      { courseId, exerciseId },
      { response: { answer: "this" } },
      studentActor,
    );

    expect(prisma.nceExerciseAttempt.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          courseId,
          exerciseId,
          studentId,
          status: NceAttemptStatus.draft,
        },
      }),
    );
    expect(prisma.nceExerciseAttempt.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: attemptId },
        data: { response: { answer: "this" } },
      }),
    );
  });

  it("scores deterministic answer keys when submitting an owned draft", async () => {
    prisma.nceExerciseAttempt.findFirst.mockResolvedValueOnce(draftAttempt);
    prisma.nceExerciseAttempt.update.mockResolvedValueOnce({
      ...draftAttempt,
      status: NceAttemptStatus.submitted,
      score: 1,
      maxScore: 1,
      feedbackJson: {
        correct: true,
        manualReviewRequired: false,
      },
      submittedAt: now,
    });

    const result = await submitNceAttempt({ attemptId }, studentActor);

    expect(prisma.nceExerciseAttempt.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: attemptId },
        data: expect.objectContaining({
          status: NceAttemptStatus.submitted,
          score: 1,
          maxScore: 1,
          submittedAt: expect.any(Date),
        }),
      }),
    );
    expect(result).toMatchObject({
      status: NceAttemptStatus.submitted,
      score: 1,
      maxScore: 1,
    });
  });

  it("scores accepted answer key aliases used by NCE authoring", async () => {
    prisma.nceExerciseAttempt.findFirst.mockResolvedValueOnce({
      ...draftAttempt,
      response: { answer: "umbrella" },
      exercise: {
        ...exercise,
        exerciseType: NceExerciseType.multiple_choice,
        answerKey: {
          correctChoiceId: "choice-a",
          acceptedAnswers: ["umbrella"],
          sample: "umbrella",
        },
      },
    });
    prisma.nceExerciseAttempt.update.mockResolvedValueOnce({
      ...draftAttempt,
      status: NceAttemptStatus.submitted,
      score: 1,
      maxScore: 1,
      feedbackJson: {
        correct: true,
        manualReviewRequired: false,
      },
      submittedAt: now,
    });

    await submitNceAttempt({ attemptId }, studentActor);

    expect(prisma.nceExerciseAttempt.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          score: 1,
          maxScore: 1,
          feedbackJson: expect.objectContaining({
            correct: true,
            manualReviewRequired: false,
          }),
        }),
      }),
    );
  });

  it("stores open-ended responses for manual review without pretending to score", async () => {
    prisma.nceExerciseAttempt.findFirst.mockResolvedValueOnce({
      ...draftAttempt,
      response: { text: "A natural translation answer." },
      exercise: {
        ...exercise,
        exerciseType: NceExerciseType.translation,
        answerKey: { rubric: ["meaning", "grammar"] },
      },
    });
    prisma.nceExerciseAttempt.update.mockResolvedValueOnce({
      ...draftAttempt,
      status: NceAttemptStatus.submitted,
      score: null,
      maxScore: null,
      feedbackJson: {
        correct: null,
        manualReviewRequired: true,
      },
      submittedAt: now,
    });

    await submitNceAttempt({ attemptId }, studentActor);

    expect(prisma.nceExerciseAttempt.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          score: null,
          maxScore: null,
          feedbackJson: expect.objectContaining({
            correct: null,
            manualReviewRequired: true,
          }),
        }),
      }),
    );
  });

  it("rejects attempt submission by a different student", async () => {
    prisma.nceExerciseAttempt.findFirst.mockResolvedValueOnce(null);

    await expect(
      submitNceAttempt({ attemptId }, otherStudentActor),
    ).rejects.toMatchObject({
      statusCode: 404,
      message: "NCE attempt not found",
    });
    expect(prisma.nceExerciseAttempt.update).not.toHaveBeenCalled();
  });

  it("marks an assigned lesson complete for an enrolled student", async () => {
    prisma.course.findFirst.mockResolvedValueOnce(course);
    prisma.nceCourseLessonAssignment.findFirst.mockResolvedValueOnce({
      courseId,
      lessonId,
    });
    prisma.nceLessonProgress.upsert.mockResolvedValueOnce({
      courseId,
      lessonId,
      studentId,
      status: NceLessonProgressStatus.completed,
      startedAt: now,
      completedAt: now,
      updatedAt: now,
    });

    const result = await completeNceLesson(
      { courseId, lessonId },
      studentActor,
    );

    expect(prisma.nceLessonProgress.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          status: NceLessonProgressStatus.completed,
          completedAt: expect.any(Date),
        }),
      }),
    );
    expect(result.status).toBe(NceLessonProgressStatus.completed);
  });

  it("rejects completion before the assigned lesson is available", async () => {
    prisma.course.findFirst.mockResolvedValueOnce(course);
    prisma.nceCourseLessonAssignment.findFirst.mockResolvedValueOnce(null);

    await expect(
      completeNceLesson({ courseId, lessonId }, studentActor),
    ).rejects.toMatchObject({
      statusCode: 404,
      message: "NCE lesson assignment not found",
    });

    expect(prisma.nceCourseLessonAssignment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          courseId,
          lessonId,
          OR: [
            { availableFrom: null },
            { availableFrom: { lte: expect.any(Date) } },
          ],
        }),
      }),
    );
    expect(prisma.nceLessonProgress.upsert).not.toHaveBeenCalled();
  });

  it("returns teacher attempt summaries without response payloads", async () => {
    prisma.course.findFirst.mockResolvedValueOnce({
      ...course,
      enrollments: [
        {
          userId: teacherId,
          roleInCourse: EnrollmentRole.teacher,
          deletedAt: null,
          user: { deletedAt: null, status: UserStatus.active },
        },
      ],
    });
    prisma.nceExerciseAttempt.findMany.mockResolvedValueOnce([
      {
        id: attemptId,
        courseId,
        lessonId,
        exerciseId,
        studentId,
        status: NceAttemptStatus.submitted,
        score: 1,
        maxScore: 1,
        submittedAt: now,
        createdAt: now,
        updatedAt: now,
        student: {
          id: studentId,
          fullName: "Student One",
          email: "student@example.com",
        },
        exercise: {
          id: exerciseId,
          exerciseType: NceExerciseType.gap_fill,
          prompt: "Complete the sentence.",
          sortOrder: 1,
          lesson: {
            id: lessonId,
            title: "Excuse me!",
            lessonNumber: 1,
          },
        },
      },
    ]);
    prisma.nceExerciseAttempt.count.mockResolvedValueOnce(1);

    const result = await listTeacherNceAttemptSummaries(
      { courseId },
      teacherActor,
      {},
    );

    expect(result.attempts[0]).toMatchObject({
      id: attemptId,
      student: { id: studentId, fullName: "Student One" },
      score: 1,
      maxScore: 1,
    });
    expect(result.attempts[0]).not.toHaveProperty("response");
  });
});
