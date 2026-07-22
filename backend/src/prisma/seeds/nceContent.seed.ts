/**
 * File: src/prisma/seeds/nceContent.seed.ts
 * Purpose: Seed representative NCE content for local demo environments.
 * Why: Mutable users, courses, enrollments, and mappings must remain explicit fixtures.
 */
import {
  EnrollmentRole,
  Prisma,
  PrismaClient,
  UserRole,
  UserStatus,
} from '../generated.js'
import { basePrisma } from '../client.js'
import { NCE_BOOK_SEEDS, type NceLessonSeed } from './nceContent.data.js'

const NCE_TEACHER_EMAIL = 'nce.content@system.local'
const NCE_COURSE_TITLE = 'New Concept English Book 1 Foundations'

async function ensureSeedCourse(prisma: Prisma.TransactionClient) {
  const teacher = await prisma.user.upsert({
    where: { email: NCE_TEACHER_EMAIL },
    create: {
      email: NCE_TEACHER_EMAIL,
      password: null,
      fullName: 'NCE Content Teacher',
      role: UserRole.teacher,
      status: UserStatus.active,
    },
    update: {
      fullName: 'NCE Content Teacher',
      role: UserRole.teacher,
      status: UserStatus.active,
    },
  })

  const courseData = {
    description: 'A seeded course path for the first NCE Book 1 lessons.',
    ownerId: teacher.id,
    learningOutcomes: [
      'Use short ownership exchanges',
      'Recognize starter NCE vocabulary',
    ],
    structureSummary: 'Sequential NCE Book 1 lessons with objective practice.',
    prerequisitesSummary: 'Beginner English learners who know the alphabet.',
  }
  const existing = await prisma.course.findFirst({
    where: { title: NCE_COURSE_TITLE, deletedAt: null },
  })
  const course = existing
    ? await prisma.course.update({
        where: { id: existing.id },
        data: courseData,
      })
    : await prisma.course.create({
        data: {
          title: NCE_COURSE_TITLE,
          ...courseData,
        },
      })

  await prisma.enrollment.upsert({
    where: { courseId_userId: { courseId: course.id, userId: teacher.id } },
    create: {
      courseId: course.id,
      userId: teacher.id,
      roleInCourse: EnrollmentRole.teacher,
    },
    update: { roleInCourse: EnrollmentRole.teacher, deletedAt: null },
  })

  return course
}

async function upsertLessonContent(
  prisma: Prisma.TransactionClient,
  lessonId: string,
  lesson: NceLessonSeed,
) {
  const objectiveIds = new Map<string, string>()

  for (const objective of lesson.objectives) {
    const record = await prisma.nceObjective.upsert({
      where: { lessonId_code: { lessonId, code: objective.code } },
      create: { lessonId, ...objective },
      update: {
        title: objective.title,
        category: objective.category,
        description: objective.description,
        masteryThreshold: objective.masteryThreshold,
        sortOrder: objective.sortOrder,
      },
    })
    objectiveIds.set(objective.code, record.id)
  }

  for (const exercise of lesson.exercises) {
    const objectiveId = objectiveIds.get(exercise.objectiveCode)
    if (!objectiveId) {
      throw new Error(`Missing NCE objective ${exercise.objectiveCode}`)
    }
    await prisma.nceExercise.upsert({
      where: {
        lessonId_exerciseType_sortOrder: {
          lessonId,
          exerciseType: exercise.exerciseType,
          sortOrder: exercise.sortOrder,
        },
      },
      create: {
        lessonId,
        objectiveId,
        exerciseType: exercise.exerciseType,
        prompt: exercise.prompt,
        content: exercise.content,
        answerKey: exercise.answerKey,
        scoringConfig: exercise.scoringConfig,
        sortOrder: exercise.sortOrder,
      },
      update: {
        objectiveId,
        prompt: exercise.prompt,
        content: exercise.content,
        answerKey: exercise.answerKey,
        scoringConfig: exercise.scoringConfig,
      },
    })
  }
}

export async function seedNceContent(
  prismaClient: PrismaClient = basePrisma,
): Promise<{ books: number; lessons: number; courseAssignments: number }> {
  return prismaClient.$transaction(async (prisma) => {
    const course = await ensureSeedCourse(prisma)
    let lessonCount = 0
    const courseLessonAssignments: Array<{ lessonId: string; sequence: number }> =
      []

    for (const bookSeed of NCE_BOOK_SEEDS) {
      const book = await prisma.nceBook.upsert({
        where: { code: bookSeed.code },
        create: {
          code: bookSeed.code,
          title: bookSeed.title,
          level: bookSeed.level,
          description: bookSeed.description,
          sortOrder: bookSeed.sortOrder,
          status: bookSeed.status,
          publishedAt: bookSeed.publishedAt,
        },
        update: {
          title: bookSeed.title,
          level: bookSeed.level,
          description: bookSeed.description,
          sortOrder: bookSeed.sortOrder,
          status: bookSeed.status,
          publishedAt: bookSeed.publishedAt,
        },
      })

      for (const unitSeed of bookSeed.units) {
        const unit = await prisma.nceUnit.upsert({
          where: {
            bookId_unitNumber: {
              bookId: book.id,
              unitNumber: unitSeed.unitNumber,
            },
          },
          create: {
            bookId: book.id,
            unitNumber: unitSeed.unitNumber,
            title: unitSeed.title,
            description: unitSeed.description,
            sortOrder: unitSeed.sortOrder,
            status: unitSeed.status,
            publishedAt: unitSeed.publishedAt,
          },
          update: {
            title: unitSeed.title,
            description: unitSeed.description,
            sortOrder: unitSeed.sortOrder,
            status: unitSeed.status,
            publishedAt: unitSeed.publishedAt,
          },
        })

        for (const lessonSeed of unitSeed.lessons) {
          const lessonData = {
            title: lessonSeed.title,
            lessonText: lessonSeed.lessonText,
            mediaJson: lessonSeed.mediaJson,
            teacherNotes: lessonSeed.teacherNotes,
            sortOrder: lessonSeed.sortOrder,
            status: lessonSeed.status,
            publishedAt: lessonSeed.publishedAt,
          }
          const existingLesson = await prisma.nceLesson.findFirst({
            where: {
              unitId: unit.id,
              lessonNumber: lessonSeed.lessonNumber,
              courseId: null,
            },
            select: { id: true },
          })
          const lesson = existingLesson
            ? await prisma.nceLesson.update({
                where: { id: existingLesson.id },
                data: lessonData,
              })
            : await prisma.nceLesson.create({
                data: {
                  unitId: unit.id,
                  lessonNumber: lessonSeed.lessonNumber,
                  courseId: null,
                  ...lessonData,
                },
              })

          await upsertLessonContent(prisma, lesson.id, lessonSeed)
          lessonCount += 1

          courseLessonAssignments.push({
            lessonId: lesson.id,
            sequence: lessonCount,
          })
        }
      }
    }

    await prisma.nceCourseLessonAssignment.deleteMany({
      where: { courseId: course.id },
    })
    for (const assignment of courseLessonAssignments) {
      await prisma.nceCourseLessonAssignment.create({
        data: {
          courseId: course.id,
          lessonId: assignment.lessonId,
          sequence: assignment.sequence,
        },
      })
    }

    return {
      books: NCE_BOOK_SEEDS.length,
      lessons: lessonCount,
      courseAssignments: courseLessonAssignments.length,
    }
  })
}
