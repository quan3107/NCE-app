/**
 * File: tests/modules/nce-content/nce-content-authoring.service.test.ts
 * Purpose: Verify NCE lesson authoring mutations.
 * Why: Protects teacher/admin editing, publish validation, and course sequencing.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  EnrollmentRole,
  NceExerciseType,
  NcePublishStatus,
  Prisma,
  UserRole,
  UserStatus,
} from "../../../src/prisma/index.js";

vi.mock("../../../src/config/prismaClient.js", () => ({
  prisma: {
    course: {
      findFirst: vi.fn(),
    },
    nceUnit: {
      findFirst: vi.fn(),
    },
    nceLesson: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    nceExercise: {
      update: vi.fn(),
    },
    nceCourseLessonAssignment: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
      findFirst: vi.fn(),
    },
  },
  runWithRole: vi.fn(async (_options, write) => write()),
}));

const prismaModule = await import("../../../src/config/prismaClient.js");
const prisma = vi.mocked(prismaModule.prisma, true);
const runWithRole = vi.mocked(prismaModule.runWithRole);

const {
  assignNceLessonsToCourse,
  createNceLesson,
  patchNceLesson,
  publishNceLesson,
  unpublishNceLesson,
} = await import("../../../src/modules/nce-content/nce-content-authoring.service.js");

const adminActor = {
  id: "11111111-1111-4111-8111-111111111111",
  role: UserRole.admin,
  status: UserStatus.active,
};
const teacherActor = {
  id: "22222222-2222-4222-8222-222222222222",
  role: UserRole.teacher,
  status: UserStatus.active,
};
const studentActor = {
  id: "33333333-3333-4333-8333-333333333333",
  role: UserRole.student,
  status: UserStatus.active,
};
const unitId = "44444444-4444-4444-8444-444444444444";
const lessonId = "55555555-5555-4555-8555-555555555555";
const courseId = "66666666-6666-4666-8666-666666666666";
const now = new Date("2026-06-18T08:00:00.000Z");

const draftLesson = {
  id: lessonId,
  unitId,
  lessonNumber: 7,
  title: "Too late",
  lessonText: "The train has already left.",
  mediaJson: null as Prisma.JsonValue,
  teacherNotes: "Practice present perfect.",
  sortOrder: 7,
  status: NcePublishStatus.draft,
  publishedAt: null,
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
  unit: {
    id: unitId,
    bookId: "77777777-7777-4777-8777-777777777777",
    unitNumber: 2,
    title: "A new phrase",
    status: NcePublishStatus.published,
    book: {
      id: "77777777-7777-4777-8777-777777777777",
      code: "nce-1",
      title: "New Concept English Book 1",
      level: "beginner",
      status: NcePublishStatus.published,
    },
  },
  objectives: [
    {
      id: "88888888-8888-4888-8888-888888888888",
      lessonId,
      code: "nce-b1-u2-l7-perfect",
      title: "Use present perfect",
      category: "grammar",
      description: "Choose the correct present-perfect form.",
      masteryThreshold: 80,
      sortOrder: 1,
    },
  ],
  exercises: [
    {
      id: "99999999-9999-4999-8999-999999999999",
      lessonId,
      objectiveId: "88888888-8888-4888-8888-888888888888",
      exerciseType: NceExerciseType.gap_fill,
      prompt: "Complete the sentence.",
      content: { sentence: "The train has ___ left." } as Prisma.JsonValue,
      answerKey: { answers: ["already"] } as Prisma.JsonValue,
      scoringConfig: { points: 1 } as Prisma.JsonValue,
      sortOrder: 1,
    },
  ],
};

const createPayload = {
  unitId,
  lessonNumber: 7,
  title: "Too late",
  lessonText: "The train has already left.",
  teacherNotes: "Practice present perfect.",
  sortOrder: 7,
  objectives: [
    {
      code: "nce-b1-u2-l7-perfect",
      title: "Use present perfect",
      category: "grammar",
      description: "Choose the correct present-perfect form.",
      masteryThreshold: 80,
      sortOrder: 1,
    },
  ],
  exercises: [
    {
      objectiveCode: "nce-b1-u2-l7-perfect",
      exerciseType: NceExerciseType.gap_fill,
      prompt: "Complete the sentence.",
      content: { sentence: "The train has ___ left." },
      answerKey: { answers: ["already"] },
      scoringConfig: { points: 1 },
      sortOrder: 1,
    },
  ],
};

const buildCourse = (ownerId = teacherActor.id) => ({
  id: courseId,
  ownerId,
  enrollments: [
    {
      userId: teacherActor.id,
      roleInCourse: EnrollmentRole.teacher,
      deletedAt: null,
      user: { deletedAt: null, status: UserStatus.active },
    },
  ],
});

const allowCourseLessonWrite = () => {
  prisma.course.findFirst.mockResolvedValueOnce(buildCourse());
  prisma.nceCourseLessonAssignment.findFirst.mockResolvedValueOnce({
    courseId,
    lessonId,
  });
};

describe("nce-content authoring service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.course.findFirst.mockReset();
    prisma.nceUnit.findFirst.mockReset();
    prisma.nceLesson.create.mockReset();
    prisma.nceLesson.findFirst.mockReset();
    prisma.nceLesson.update.mockReset();
    prisma.nceExercise.update.mockReset();
    prisma.nceCourseLessonAssignment.deleteMany.mockReset();
    prisma.nceCourseLessonAssignment.createMany.mockReset();
    prisma.nceCourseLessonAssignment.findFirst.mockReset();
    runWithRole.mockImplementation(async (_options, write) => write());
  });

  it("creates a draft lesson with objectives and exercises for admins", async () => {
    prisma.nceUnit.findFirst.mockResolvedValueOnce({
      id: unitId,
      deletedAt: null,
      status: NcePublishStatus.published,
      book: { deletedAt: null, status: NcePublishStatus.published },
    });
    prisma.nceLesson.create.mockResolvedValueOnce(draftLesson);
    prisma.nceLesson.update.mockResolvedValueOnce(draftLesson);

    const result = await createNceLesson(createPayload, adminActor);

    expect(prisma.nceLesson.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          unitId,
          lessonNumber: 7,
          status: NcePublishStatus.draft,
          objectives: {
            create: [
              expect.objectContaining({
                code: "nce-b1-u2-l7-perfect",
                masteryThreshold: 80,
              }),
            ],
          },
        }),
      }),
    );
    expect(prisma.nceLesson.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({
          exercises: expect.anything(),
        }),
      }),
    );
    expect(result.status).toBe(NcePublishStatus.draft);
    expect(result.exercises[0]).toHaveProperty("answerKey");
  });

  it("links newly created exercises to authored objectives by objectiveCode", async () => {
    prisma.nceUnit.findFirst.mockResolvedValueOnce({
      id: unitId,
      deletedAt: null,
      status: NcePublishStatus.published,
      book: { deletedAt: null, status: NcePublishStatus.published },
    });
    prisma.nceLesson.create.mockResolvedValueOnce({
      ...draftLesson,
      exercises: [],
    });
    prisma.nceLesson.update.mockResolvedValueOnce(draftLesson);

    await createNceLesson(createPayload, adminActor);

    expect(prisma.nceLesson.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: lessonId },
        data: {
          exercises: {
            create: [
              expect.objectContaining({
                objectiveId: "88888888-8888-4888-8888-888888888888",
                exerciseType: NceExerciseType.gap_fill,
              }),
            ],
          },
        },
      }),
    );
  });

  it("rejects exercise objective IDs from outside the authored lesson", async () => {
    prisma.nceUnit.findFirst.mockResolvedValueOnce({
      id: unitId,
      deletedAt: null,
      status: NcePublishStatus.published,
      book: { deletedAt: null, status: NcePublishStatus.published },
    });
    prisma.nceLesson.create.mockResolvedValueOnce({
      ...draftLesson,
      exercises: [],
    });

    await expect(
      createNceLesson(
        {
          ...createPayload,
          exercises: [
            {
              ...createPayload.exercises[0],
              objectiveCode: undefined,
              objectiveId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            },
          ],
        },
        adminActor,
      ),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "NCE exercise objectiveId does not match an authored objective",
    });
  });

  it("relinks exercises to recreated objectives when patching a lesson", async () => {
    const recreatedObjectiveId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const patchedLesson = {
      ...draftLesson,
      objectives: [
        {
          ...draftLesson.objectives[0],
          id: recreatedObjectiveId,
        },
      ],
      exercises: [],
    };
    const finalLesson = {
      ...draftLesson,
      objectives: patchedLesson.objectives,
      exercises: [
        {
          ...draftLesson.exercises[0],
          objectiveId: recreatedObjectiveId,
        },
      ],
    };
    allowCourseLessonWrite();
    prisma.nceLesson.findFirst.mockResolvedValueOnce(draftLesson);
    prisma.nceLesson.update
      .mockResolvedValueOnce(patchedLesson)
      .mockResolvedValueOnce(finalLesson);

    await patchNceLesson(
      { lessonId, courseId },
      {
        objectives: createPayload.objectives,
        exercises: createPayload.exercises,
      },
      teacherActor,
    );

    expect(prisma.nceLesson.update).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { id: lessonId },
        data: expect.objectContaining({
          exercises: { deleteMany: {} },
          objectives: expect.objectContaining({
            deleteMany: {},
          }),
        }),
      }),
    );
    expect(prisma.nceLesson.update).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: { id: lessonId },
        data: {
          exercises: {
            create: [
              expect.objectContaining({
                objectiveId: recreatedObjectiveId,
              }),
            ],
          },
        },
      }),
    );
  });

  it("preserves exercise objective links during objective-only patches", async () => {
    const recreatedObjectiveId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const patchedLesson = {
      ...draftLesson,
      objectives: [
        {
          ...draftLesson.objectives[0],
          id: recreatedObjectiveId,
        },
      ],
      exercises: [
        {
          ...draftLesson.exercises[0],
          objectiveId: null,
        },
      ],
    };
    const finalLesson = {
      ...draftLesson,
      objectives: patchedLesson.objectives,
      exercises: [
        {
          ...draftLesson.exercises[0],
          objectiveId: recreatedObjectiveId,
        },
      ],
    };
    allowCourseLessonWrite();
    prisma.nceLesson.findFirst
      .mockResolvedValueOnce(draftLesson)
      .mockResolvedValueOnce(finalLesson);
    prisma.nceLesson.update.mockResolvedValueOnce(patchedLesson);
    prisma.nceExercise.update.mockResolvedValueOnce(finalLesson.exercises[0]);

    try {
      await patchNceLesson(
        { lessonId, courseId },
        {
          objectives: createPayload.objectives,
        },
        teacherActor,
      );

      expect(prisma.nceExercise.update).toHaveBeenCalledWith({
        where: { id: draftLesson.exercises[0].id },
        data: { objectiveId: recreatedObjectiveId },
      });
    } finally {
      prisma.nceLesson.findFirst.mockReset();
      prisma.nceLesson.update.mockReset();
      prisma.nceExercise.update.mockReset();
    }
  });

  it("rejects malformed exercise answer keys before writing", async () => {
    await expect(
      createNceLesson(
        {
          ...createPayload,
          exercises: [
            {
              ...createPayload.exercises[0],
              answerKey: {},
            },
          ],
        },
        adminActor,
      ),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "NCE exercise answer key is incomplete",
    });

    expect(prisma.nceLesson.create).not.toHaveBeenCalled();
  });

  it("rejects blank exercise answer strings before writing", async () => {
    await expect(
      createNceLesson(
        {
          ...createPayload,
          exercises: [
            {
              ...createPayload.exercises[0],
              answerKey: { answers: [""] },
            },
          ],
        },
        adminActor,
      ),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "NCE exercise answer key is incomplete",
    });

    expect(prisma.nceLesson.create).not.toHaveBeenCalled();
  });

  it("stores explicit null media as Prisma JSON null on create", async () => {
    prisma.nceUnit.findFirst.mockResolvedValueOnce({
      id: unitId,
      deletedAt: null,
      status: NcePublishStatus.published,
      book: { deletedAt: null, status: NcePublishStatus.published },
    });
    prisma.nceLesson.create.mockResolvedValueOnce({
      ...draftLesson,
      mediaJson: null,
    });
    prisma.nceLesson.update.mockResolvedValueOnce(draftLesson);

    await createNceLesson(
      {
        ...createPayload,
        media: null,
      },
      adminActor,
    );

    expect(prisma.nceLesson.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          mediaJson: Prisma.JsonNull,
        }),
      }),
    );
  });

  it("requires teacher or admin role for authoring", async () => {
    await expect(
      createNceLesson(createPayload, studentActor),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: "Teacher or admin access is required",
    });
  });

  it("rejects publish when a lesson has no objectives or exercises", async () => {
    prisma.nceLesson.findFirst.mockResolvedValueOnce({
      ...draftLesson,
      objectives: [],
      exercises: [],
    });

    await expect(
      publishNceLesson({ lessonId }, adminActor),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: "Add at least one objective and one exercise before publishing",
    });

    expect(prisma.nceLesson.update).not.toHaveBeenCalled();
  });

  it("requires teacher lesson patches to be scoped to a writable assigned course", async () => {
    prisma.nceLesson.findFirst.mockResolvedValueOnce(draftLesson);

    await expect(
      patchNceLesson({ lessonId }, { title: "Other lesson" }, teacherActor),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "courseId is required to modify teacher NCE lessons",
    });

    expect(prisma.nceLesson.update).not.toHaveBeenCalled();
  });

  it("rejects teacher lesson patches outside the scoped course assignment", async () => {
    prisma.nceLesson.findFirst.mockResolvedValueOnce(draftLesson);
    prisma.course.findFirst.mockResolvedValueOnce(buildCourse());
    prisma.nceCourseLessonAssignment.findFirst.mockResolvedValueOnce(null);

    await expect(
      patchNceLesson(
        { lessonId, courseId },
        { title: "Other lesson" },
        teacherActor,
      ),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: "NCE lesson is not assigned to this course",
    });

    expect(prisma.nceLesson.update).not.toHaveBeenCalled();
  });

  it("requires teacher publish and unpublish actions to be course scoped", async () => {
    prisma.nceLesson.findFirst
      .mockResolvedValueOnce(draftLesson)
      .mockResolvedValueOnce({
        ...draftLesson,
        status: NcePublishStatus.published,
        publishedAt: now,
      });

    await expect(
      publishNceLesson({ lessonId }, teacherActor),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "courseId is required to modify teacher NCE lessons",
    });
    await expect(
      unpublishNceLesson({ lessonId }, teacherActor),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "courseId is required to modify teacher NCE lessons",
    });

    expect(prisma.nceLesson.update).not.toHaveBeenCalled();
  });

  it("publishes coherent draft lessons and records publishedAt", async () => {
    allowCourseLessonWrite();
    prisma.nceLesson.findFirst.mockResolvedValueOnce(draftLesson);
    prisma.nceLesson.update.mockResolvedValueOnce({
      ...draftLesson,
      status: NcePublishStatus.published,
      publishedAt: now,
    });

    const result = await publishNceLesson({ lessonId, courseId }, teacherActor);

    expect(prisma.nceLesson.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: lessonId },
        data: expect.objectContaining({
          status: NcePublishStatus.published,
          publishedAt: expect.any(Date),
        }),
      }),
    );
    expect(result.status).toBe(NcePublishStatus.published);
  });

  it("unpublishes a lesson without deleting content", async () => {
    allowCourseLessonWrite();
    prisma.nceLesson.findFirst.mockResolvedValueOnce({
      ...draftLesson,
      status: NcePublishStatus.published,
      publishedAt: now,
    });
    prisma.nceLesson.update.mockResolvedValueOnce({
      ...draftLesson,
      status: NcePublishStatus.draft,
      publishedAt: null,
    });

    const result = await unpublishNceLesson({ lessonId, courseId }, teacherActor);

    expect(prisma.nceLesson.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: lessonId },
        data: {
          status: NcePublishStatus.draft,
          publishedAt: null,
        },
      }),
    );
    expect(result.status).toBe(NcePublishStatus.draft);
  });

  it("lets a course teacher replace ordered course lesson assignments", async () => {
    prisma.course.findFirst.mockResolvedValueOnce(buildCourse());

    const result = await assignNceLessonsToCourse(
      { courseId },
      {
        lessons: [
          {
            lessonId,
            sequence: 1,
            availableFrom: "2026-06-20T00:00:00.000Z",
            dueAt: "2026-06-27T00:00:00.000Z",
          },
        ],
      },
      teacherActor,
    );

    expect(prisma.nceCourseLessonAssignment.deleteMany).toHaveBeenCalledWith({
      where: { courseId },
    });
    expect(prisma.nceCourseLessonAssignment.createMany).toHaveBeenCalledWith({
      data: [
        {
          courseId,
          lessonId,
          sequence: 1,
          availableFrom: new Date("2026-06-20T00:00:00.000Z"),
          dueAt: new Date("2026-06-27T00:00:00.000Z"),
        },
      ],
    });
    expect(result).toEqual({ courseId, assignedCount: 1 });
  });
});
