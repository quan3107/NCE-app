/**
 * File: src/prisma/seeds/nceContent.seed.ts
 * Purpose: Seed first-release NCE content in an idempotent way.
 * Why: Fresh environments need representative NCE books, lessons, exercises, and course mapping.
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
    let courseAssignments = 0

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
          const lesson = await prisma.nceLesson.upsert({
            where: {
              unitId_lessonNumber: {
                unitId: unit.id,
                lessonNumber: lessonSeed.lessonNumber,
              },
            },
            create: {
              unitId: unit.id,
              lessonNumber: lessonSeed.lessonNumber,
              title: lessonSeed.title,
              lessonText: lessonSeed.lessonText,
              mediaJson: lessonSeed.mediaJson,
              teacherNotes: lessonSeed.teacherNotes,
              sortOrder: lessonSeed.sortOrder,
              status: lessonSeed.status,
              publishedAt: lessonSeed.publishedAt,
            },
            update: {
              title: lessonSeed.title,
              lessonText: lessonSeed.lessonText,
              mediaJson: lessonSeed.mediaJson,
              teacherNotes: lessonSeed.teacherNotes,
              sortOrder: lessonSeed.sortOrder,
              status: lessonSeed.status,
              publishedAt: lessonSeed.publishedAt,
            },
          })

          await upsertLessonContent(prisma, lesson.id, lessonSeed)
          lessonCount += 1

          await prisma.nceCourseLessonAssignment.upsert({
            where: {
              courseId_sequence: {
                courseId: course.id,
                sequence: lessonCount,
              },
            },
            create: {
              courseId: course.id,
              lessonId: lesson.id,
              sequence: lessonCount,
            },
            update: { lessonId: lesson.id },
          })
          courseAssignments += 1
        }
      }
    }

    return {
      books: NCE_BOOK_SEEDS.length,
      lessons: lessonCount,
      courseAssignments,
    }
  })
}
