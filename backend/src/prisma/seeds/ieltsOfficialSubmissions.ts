/**
 * File: src/prisma/seeds/ieltsOfficialSubmissions.ts
 * Purpose: Build current IELTS submission payloads for official seed assignments.
 * Why: Keeps demo submissions aligned with the payload schemas used by grading and AI feedback.
 */
import type { Prisma } from '../generated.js'

type WritingSubmissionSeed = {
  task1Text: string
  task2Text: string
  durationSeconds: number
}

type ObjectiveQuestion = {
  id?: unknown
  answer?: unknown
  correctAnswer?: unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function objectiveAnswersFromConfig(
  assignmentConfig: unknown,
): Array<{ questionId: string; value: Prisma.InputJsonValue }> {
  if (!isRecord(assignmentConfig) || !Array.isArray(assignmentConfig.sections)) {
    return []
  }

  return assignmentConfig.sections.flatMap((section) => {
    if (!isRecord(section) || !Array.isArray(section.questions)) {
      return []
    }

    return section.questions.flatMap((questionValue) => {
      const question = questionValue as ObjectiveQuestion
      const value = question.answer ?? question.correctAnswer
      if (typeof question.id !== 'string' || value === undefined || value === null) {
        return []
      }

      return [{ questionId: question.id, value: value as Prisma.InputJsonValue }]
    })
  })
}

export const PRIMARY_IELTS_WRITING_SUBMISSION_SEED_MAP: Record<
  string,
  WritingSubmissionSeed
> = {
  'Academic Essay: Technology and Society': {
    durationSeconds: 3_420,
    task1Text:
      'The line graph shows that public transport use increased in all four city zones between 2005 and 2025. The central zone remained the busiest area, while the outer zone showed the fastest growth after new rail links opened.',
    task2Text:
      'Governments should give public transport clear priority because it reduces congestion and helps people reach work and study at a lower cost. Road expansion can be useful in selected areas, but it often encourages more private car use and does not solve long-term traffic pressure.',
  },
  'Data Interpretation Task 1: Global Energy Mix': {
    durationSeconds: 3_360,
    task1Text:
      'The table indicates that several regions reduced their reliance on coal between 2010 and 2025, while renewable energy became a larger part of the household energy mix. Gas remained important, but its share changed less dramatically than solar and wind.',
    task2Text:
      'Remote work benefits many employees by saving travel time and giving families more flexibility. However, employers still need shared office time for training, collaboration, and new staff support, so a balanced hybrid model is usually stronger than a fully remote one.',
  },
  'General Training Letter: Workplace Equipment': {
    durationSeconds: 3_300,
    task1Text:
      'Dear Facilities Manager, I am writing to request replacement headsets and an additional monitor for the customer support desk. The current equipment frequently disconnects during calls, which delays responses and makes it harder for staff to assist clients professionally.',
    task2Text:
      'Online public services can be positive when they make routine tasks faster and more accessible. Even so, governments should keep some face-to-face options because older residents, people with limited internet access, and complex cases still need personal support.',
  },
}

export function buildIeltsWritingSubmissionPayload(
  title: string,
): Prisma.InputJsonObject {
  const seed = PRIMARY_IELTS_WRITING_SUBMISSION_SEED_MAP[title]
  if (!seed) {
    throw new Error(`Missing IELTS writing submission seed for ${title}`)
  }

  return {
    version: 1,
    durationSeconds: seed.durationSeconds,
    task1: { text: seed.task1Text },
    task2: { text: seed.task2Text },
  }
}

export function buildIeltsObjectiveSubmissionPayload(
  title: string,
  assignmentConfig: unknown,
): Prisma.InputJsonObject {
  const answers = objectiveAnswersFromConfig(assignmentConfig)
  if (answers.length === 0) {
    throw new Error(`Missing IELTS objective answers for ${title}`)
  }

  return {
    version: 1,
    answers,
  }
}
