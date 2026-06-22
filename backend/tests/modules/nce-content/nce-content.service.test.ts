/**
 * File: tests/modules/nce-content/nce-content.service.test.ts
 * Purpose: Verify NCE read filtering, authorization, and response mapping.
 * Why: Protects draft visibility and answer-key handling for student-facing content.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  EnrollmentRole,
  NceExerciseType,
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
    nceBook: {
      findMany: vi.fn(),
    },
    nceUnit: {
      findMany: vi.fn(),
    },
    nceLesson: {
      count: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    nceCourseLessonAssignment: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
  },
  runWithRole: vi.fn(async (_options, read) => read()),
}));

const prismaModule = await import("../../../src/config/prismaClient.js");
const prisma = vi.mocked(prismaModule.prisma, true);

const {
  getNceLesson,
  listCourseNceLessons,
  listNceBooks,
  listNceLessons,
  listNceUnits,
} = await import("../../../src/modules/nce-content/nce-content.service.js");

const courseId = "11111111-1111-4111-8111-111111111111";
const lessonId = "22222222-2222-4222-8222-222222222222";
const unitId = "33333333-3333-4333-8333-333333333333";
const bookId = "77777777-7777-4777-8777-777777777777";
const teacherId = "44444444-4444-4444-8444-444444444444";
const studentId = "55555555-5555-4555-8555-555555555555";
const adminId = "66666666-6666-4666-8666-666666666666";
const now = new Date("2026-06-17T10:00:00.000Z");
const draftReadableStatuses = [
  NcePublishStatus.published,
  NcePublishStatus.draft,
];

const adminActor = {
  id: adminId,
  role: UserRole.admin,
  status: UserStatus.active,
};
const teacherActor = {
  id: teacherId,
  role: UserRole.teacher,
  status: UserStatus.active,
};
const studentActor = {
  id: studentId,
  role: UserRole.student,
  status: UserStatus.active,
};

const buildCourse = (roleInCourse: EnrollmentRole = EnrollmentRole.teacher) => ({
  id: courseId,
  ownerId: roleInCourse === EnrollmentRole.teacher ? "owner-id" : "other-owner",
  deletedAt: null,
  enrollments: [
    {
      userId: roleInCourse === EnrollmentRole.student ? studentId : teacherId,
      roleInCourse,
      deletedAt: null,
      user: { deletedAt: null, status: UserStatus.active },
    },
  ],
});

const buildLesson = (status = NcePublishStatus.published) => ({
  id: lessonId,
  unitId,
  lessonNumber: 1,
  title: "Excuse me!",
  lessonText: "Excuse me! Is this your handbag?",
  mediaJson: { audioKey: "nce/book1/lesson1/dialogue.mp3" } as Prisma.JsonValue,
  teacherNotes: "Focus on polite intonation.",
  sortOrder: 1,
  status,
  publishedAt: status === NcePublishStatus.published ? now : null,
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
  unit: {
    id: unitId,
    bookId: "book-1",
    unitNumber: 1,
    title: "First Things First",
    status: NcePublishStatus.published,
    book: {
      id: "book-1",
      code: "nce-1",
      title: "New Concept English Book 1",
      level: "beginner",
      status: NcePublishStatus.published,
    },
  },
  objectives: [
    {
      id: "objective-1",
      lessonId,
      code: "nce-b1-u1-l1-politeness",
      title: "Use polite attention-getters",
      category: "speaking",
      description: "Open short exchanges politely.",
      masteryThreshold: 80,
      sortOrder: 1,
      createdAt: now,
      updatedAt: now,
    },
  ],
  exercises: [
    {
      id: "exercise-1",
      lessonId,
      objectiveId: "objective-1",
      exerciseType: NceExerciseType.gap_fill,
      prompt: "Complete the sentence.",
      content: { sentence: "Is ___ your handbag?", blanks: ["___"] } as Prisma.JsonValue,
      answerKey: { answers: ["this"] } as Prisma.JsonValue,
      scoringConfig: { points: 1 } as Prisma.JsonValue,
      sortOrder: 1,
      createdAt: now,
      updatedAt: now,
    },
  ],
});

describe("nce-content.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists only published books for public callers", async () => {
    prisma.nceBook.findMany.mockResolvedValueOnce([
      {
        id: "book-1",
        code: "nce-1",
        title: "New Concept English Book 1",
        level: "beginner",
        description: "Starter lessons.",
        sortOrder: 1,
        status: NcePublishStatus.published,
        publishedAt: now,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      },
    ]);

    const result = await listNceBooks(undefined, {});

    expect(prisma.nceBook.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          deletedAt: null,
          status: NcePublishStatus.published,
        },
      }),
    );
    expect(result.books).toEqual([
      expect.objectContaining({
        id: "book-1",
        code: "nce-1",
        status: NcePublishStatus.published,
      }),
    ]);
    expect(JSON.stringify(result)).not.toContain("deletedAt");
  });

  it("rejects course context on public published book reads", async () => {
    await expect(
      listNceBooks(undefined, { courseId }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "courseId can only be used with includeDrafts=true on public NCE content routes",
    });

    expect(prisma.nceBook.findMany).not.toHaveBeenCalled();
  });

  it("excludes archived books from draft-inclusive reads", async () => {
    prisma.course.findFirst.mockResolvedValueOnce(buildCourse());
    prisma.nceBook.findMany.mockResolvedValueOnce([]);

    await listNceBooks(
      teacherActor,
      { includeDrafts: "true", courseId },
    );

    expect(prisma.nceBook.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: draftReadableStatuses },
        }),
      }),
    );
  });

  it("excludes archived units from draft-inclusive reads", async () => {
    prisma.course.findFirst.mockResolvedValueOnce(buildCourse());
    prisma.nceUnit.findMany.mockResolvedValueOnce([]);

    await listNceUnits(
      { bookId },
      teacherActor,
      { includeDrafts: "true", courseId },
    );

    expect(prisma.nceUnit.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: draftReadableStatuses },
          book: {
            status: { in: draftReadableStatuses },
            deletedAt: null,
          },
        }),
      }),
    );
  });

  it("lets an authorized course teacher include assigned draft lessons", async () => {
    prisma.course.findFirst.mockResolvedValueOnce(buildCourse());
    prisma.nceLesson.findMany.mockResolvedValueOnce([
      buildLesson(NcePublishStatus.draft),
    ]);
    prisma.nceLesson.count.mockResolvedValueOnce(1);

    const result = await listNceLessons(
      { unitId },
      teacherActor,
      { includeDrafts: "true", courseId },
    );

    expect(prisma.course.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: courseId, deletedAt: null },
      }),
    );
    expect(prisma.nceLesson.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          unitId,
          deletedAt: null,
          status: { in: draftReadableStatuses },
          courseAssignments: { some: { courseId } },
          unit: {
            status: { in: draftReadableStatuses },
            book: {
              status: { in: draftReadableStatuses },
              deletedAt: null,
            },
            deletedAt: null,
          },
        }),
      }),
    );
    expect(result.lessons[0]?.status).toBe(NcePublishStatus.draft);
  });

  it("rejects draft reads for teachers outside the requested course", async () => {
    prisma.course.findFirst.mockResolvedValueOnce({
      ...buildCourse(),
      enrollments: [],
      ownerId: "someone-else",
    });

    await expect(
      listNceLessons(
        { unitId },
        teacherActor,
        { includeDrafts: "true", courseId },
      ),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: "You do not have permission to access this course",
    });
    expect(prisma.nceLesson.findMany).not.toHaveBeenCalled();
  });

  it("hides answer keys from student course lesson reads", async () => {
    prisma.course.findFirst.mockResolvedValueOnce(buildCourse(EnrollmentRole.student));
    prisma.nceCourseLessonAssignment.findMany.mockResolvedValueOnce([
      {
        id: "assignment-1",
        courseId,
        lessonId,
        sequence: 1,
        availableFrom: null,
        dueAt: null,
        createdAt: now,
        updatedAt: now,
        lesson: buildLesson(),
      },
    ]);
    prisma.nceCourseLessonAssignment.count.mockResolvedValueOnce(1);

    const result = await listCourseNceLessons(
      { courseId },
      studentActor,
      {},
    );

    expect(prisma.nceCourseLessonAssignment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          courseId,
          lesson: expect.objectContaining({
            status: NcePublishStatus.published,
            unit: {
              status: NcePublishStatus.published,
              book: { status: NcePublishStatus.published, deletedAt: null },
              deletedAt: null,
            },
          }),
        }),
      }),
    );
    expect(result.lessons[0]?.exercises[0]).not.toHaveProperty("answerKey");
    expect(result.lessons[0]).toMatchObject({
      canEdit: false,
      canPublish: false,
    });
  });

  it("marks only course-scoped assigned lessons editable for course teachers", async () => {
    prisma.course.findFirst.mockResolvedValueOnce(buildCourse());
    prisma.nceCourseLessonAssignment.findMany.mockResolvedValueOnce([
      {
        sequence: 1,
        availableFrom: null,
        dueAt: null,
        lesson: { ...buildLesson(NcePublishStatus.draft), courseId },
      },
      {
        sequence: 2,
        availableFrom: null,
        dueAt: null,
        lesson: {
          ...buildLesson(),
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          courseId: null,
        },
      },
    ]);
    prisma.nceCourseLessonAssignment.count.mockResolvedValueOnce(2);

    const result = await listCourseNceLessons(
      { courseId },
      teacherActor,
      { includeDrafts: "true" },
    );

    expect(prisma.nceCourseLessonAssignment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          lesson: expect.objectContaining({
            select: expect.objectContaining({
              courseId: true,
            }),
          }),
        }),
      }),
    );
    expect(result.lessons).toEqual([
      expect.objectContaining({
        id: lessonId,
        canEdit: true,
        canPublish: true,
      }),
      expect.objectContaining({
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        canEdit: false,
        canPublish: false,
      }),
    ]);
  });

  it("excludes archived course lessons from draft-inclusive course reads", async () => {
    prisma.course.findFirst.mockResolvedValueOnce(buildCourse());
    prisma.nceCourseLessonAssignment.findMany.mockResolvedValueOnce([
      {
        sequence: 1,
        availableFrom: null,
        dueAt: null,
        lesson: buildLesson(NcePublishStatus.draft),
      },
    ]);
    prisma.nceCourseLessonAssignment.count.mockResolvedValueOnce(1);

    await listCourseNceLessons(
      { courseId },
      teacherActor,
      { includeDrafts: "true" },
    );

    expect(prisma.nceCourseLessonAssignment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          courseId,
          lesson: expect.objectContaining({
            status: { in: draftReadableStatuses },
            unit: {
              status: { in: draftReadableStatuses },
              book: {
                status: { in: draftReadableStatuses },
                deletedAt: null,
              },
              deletedAt: null,
            },
          }),
        }),
      }),
    );
  });

  it("returns a published lesson without internal fields for public callers", async () => {
    prisma.nceLesson.findFirst.mockResolvedValueOnce(buildLesson());

    const result = await getNceLesson({ lessonId }, undefined, {});

    expect(prisma.nceLesson.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: lessonId,
          courseId: null,
          deletedAt: null,
          status: NcePublishStatus.published,
        }),
      }),
    );
    expect(result.exercises[0]).not.toHaveProperty("answerKey");
    expect(result).not.toHaveProperty("teacherNotes");
    expect(JSON.stringify(result)).not.toContain("deletedAt");
  });

  it("rejects course context on public published lesson reads", async () => {
    await expect(
      listNceLessons({ unitId }, undefined, { courseId }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "courseId can only be used with includeDrafts=true on public NCE content routes",
    });

    expect(prisma.nceLesson.findMany).not.toHaveBeenCalled();
    expect(prisma.nceLesson.count).not.toHaveBeenCalled();
  });

  it("requires auth before applying draft course context on public routes", async () => {
    await expect(
      getNceLesson(
        { lessonId },
        undefined,
        { includeDrafts: "true", courseId },
      ),
    ).rejects.toMatchObject({
      statusCode: 401,
      message: "Unauthorized",
    });

    expect(prisma.nceLesson.findFirst).not.toHaveBeenCalled();
  });

  it("requires course context for admin draft reads on public routes", async () => {
    await expect(
      listNceLessons(
        { unitId },
        adminActor,
        { includeDrafts: "true" },
      ),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "courseId is required to include draft NCE content",
    });

    expect(prisma.nceLesson.findMany).not.toHaveBeenCalled();
    expect(prisma.nceLesson.count).not.toHaveBeenCalled();
  });

  it("does not select restricted lesson or exercise columns for student-safe reads", async () => {
    prisma.nceLesson.findFirst.mockResolvedValueOnce(buildLesson());

    await getNceLesson({ lessonId }, undefined, {});

    expect(prisma.nceLesson.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          teacherNotes: false,
          exercises: expect.objectContaining({
            select: expect.not.objectContaining({
              answerKey: true,
            }),
          }),
        }),
      }),
    );
  });

  it("returns answer keys to authorized course teachers reading drafts", async () => {
    prisma.course.findFirst.mockResolvedValueOnce(buildCourse());
    prisma.nceLesson.findFirst.mockResolvedValueOnce(
      buildLesson(NcePublishStatus.draft),
    );

    const result = await getNceLesson(
      { lessonId },
      teacherActor,
      { includeDrafts: "true", courseId },
    );

    expect(prisma.nceLesson.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: lessonId,
          courseAssignments: { some: { courseId } },
        }),
      }),
    );
    expect(result.teacherNotes).toBe("Focus on polite intonation.");
    expect(result.exercises[0]).toHaveProperty("answerKey", {
      answers: ["this"],
    });
  });

  it("reports the total matching lessons separately from the current page size", async () => {
    prisma.nceLesson.findMany.mockResolvedValueOnce([buildLesson()]);
    prisma.nceLesson.count.mockResolvedValueOnce(42);

    const result = await listNceLessons(
      { unitId },
      undefined,
      { page: "2", pageSize: "1" },
    );

    expect(prisma.nceLesson.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ unitId, courseId: null }),
      }),
    );
    expect(prisma.nceLesson.count).toHaveBeenCalledWith({
      where: expect.objectContaining({ unitId, courseId: null }),
    });
    expect(result.pagination).toEqual({
      page: 2,
      pageSize: 1,
      total: 42,
    });
  });
});
