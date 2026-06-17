/**
 * File: src/prisma/seeds/nceContent.data.ts
 * Purpose: Hold static New Concept English seed content.
 * Why: Keeps the NCE content seed deterministic, reviewable, and separate from demo data.
 */
import { NceExerciseType, NcePublishStatus, type Prisma } from '../generated.js'

export const NCE_EXERCISE_TYPES = [
  NceExerciseType.vocabulary,
  NceExerciseType.grammar,
  NceExerciseType.listening,
  NceExerciseType.speaking,
  NceExerciseType.reading,
  NceExerciseType.writing,
  NceExerciseType.translation,
  NceExerciseType.dictation,
  NceExerciseType.multiple_choice,
  NceExerciseType.gap_fill,
] as const

type NceObjectiveSeed = {
  code: string
  title: string
  category: string
  description: string
  masteryThreshold: number
  sortOrder: number
}

type NceExerciseSeed = {
  objectiveCode: string
  exerciseType: (typeof NCE_EXERCISE_TYPES)[number]
  prompt: string
  content: Prisma.InputJsonObject
  answerKey: Prisma.InputJsonObject
  scoringConfig: Prisma.InputJsonObject
  sortOrder: number
}

export type NceLessonSeed = {
  lessonNumber: number
  title: string
  lessonText: string
  mediaJson: Prisma.InputJsonObject
  teacherNotes: string
  sortOrder: number
  status: NcePublishStatus
  publishedAt: Date
  objectives: NceObjectiveSeed[]
  exercises: NceExerciseSeed[]
}

export type NceBookSeed = {
  code: string
  title: string
  level: string
  description: string
  sortOrder: number
  status: NcePublishStatus
  publishedAt: Date
  units: Array<{
    unitNumber: number
    title: string
    description: string
    sortOrder: number
    status: NcePublishStatus
    publishedAt: Date
    lessons: NceLessonSeed[]
  }>
}

const publishedAt = new Date('2026-06-17T00:00:00.000Z')

export const NCE_BOOK_SEEDS: NceBookSeed[] = [
  {
    code: 'NCE-BOOK-1',
    title: 'New Concept English Book 1',
    level: 'beginner',
    description:
      'A representative starter path for foundational sentence patterns, classroom objects, and short daily-life exchanges.',
    sortOrder: 1,
    status: NcePublishStatus.published,
    publishedAt,
    units: [
      {
        unitNumber: 1,
        title: 'First Encounters',
        description: 'Introductions, classroom objects, and simple questions.',
        sortOrder: 1,
        status: NcePublishStatus.published,
        publishedAt,
        lessons: [
          {
            lessonNumber: 1,
            title: 'Excuse Me!',
            lessonText:
              'Excuse me. Is this your handbag? Pardon? Is this your handbag? Yes, it is. Thank you very much. Students practice polite attention-getting, ownership questions, and short yes responses.',
            mediaJson: {
              audio: [
                {
                  label: 'dialogue',
                  objectKey: 'nce/book1/lesson1/dialogue.mp3',
                },
              ],
            },
            teacherNotes:
              'Model rising intonation on yes/no questions and drill the contrast between this and your.',
            sortOrder: 1,
            status: NcePublishStatus.published,
            publishedAt,
            objectives: [
              {
                code: 'nce-b1-u1-l1-politeness',
                title: 'Use polite interruption phrases',
                category: 'speaking',
                description:
                  'Students can use Excuse me and Thank you very much naturally.',
                masteryThreshold: 80,
                sortOrder: 1,
              },
              {
                code: 'nce-b1-u1-l1-ownership',
                title: 'Ask and answer ownership questions',
                category: 'grammar',
                description:
                  'Students can form Is this your...? and respond with it is.',
                masteryThreshold: 80,
                sortOrder: 2,
              },
            ],
            exercises: [
              {
                objectiveCode: 'nce-b1-u1-l1-politeness',
                exerciseType: NceExerciseType.vocabulary,
                prompt: 'Match each classroom object to its meaning.',
                content: {
                  terms: ['handbag', 'pardon', 'excuse me'],
                  choices: ['a small bag', 'please repeat', 'polite interruption'],
                },
                answerKey: {
                  matches: {
                    handbag: 'a small bag',
                    pardon: 'please repeat',
                    'excuse me': 'polite interruption',
                  },
                },
                scoringConfig: { pointsPerMatch: 1, maxScore: 3 },
                sortOrder: 1,
              },
              {
                objectiveCode: 'nce-b1-u1-l1-ownership',
                exerciseType: NceExerciseType.grammar,
                prompt: 'Complete the ownership question pattern.',
                content: { sentence: 'Is ___ your handbag?', blanks: ['___'] },
                answerKey: { blanks: ['this'] },
                scoringConfig: { pointsPerBlank: 1, maxScore: 1 },
                sortOrder: 2,
              },
              {
                objectiveCode: 'nce-b1-u1-l1-politeness',
                exerciseType: NceExerciseType.listening,
                prompt: 'Listen and choose the phrase you hear first.',
                content: {
                  audioKey: 'nce/book1/lesson1/dialogue.mp3',
                  choices: ['Excuse me', 'Thank you', 'Good morning'],
                },
                answerKey: { choice: 'Excuse me' },
                scoringConfig: { maxScore: 1 },
                sortOrder: 3,
              },
              {
                objectiveCode: 'nce-b1-u1-l1-politeness',
                exerciseType: NceExerciseType.speaking,
                prompt: 'Record the dialogue using polite intonation.',
                content: {
                  lines: ['Excuse me.', 'Is this your handbag?', 'Yes, it is.'],
                },
                answerKey: {
                  rubric: [
                    'polite opening',
                    'clear question intonation',
                    'complete answer',
                  ],
                },
                scoringConfig: { rubricPoints: 3, maxScore: 3 },
                sortOrder: 4,
              },
              {
                objectiveCode: 'nce-b1-u1-l1-ownership',
                exerciseType: NceExerciseType.multiple_choice,
                prompt: 'Choose the correct response: Is this your handbag?',
                content: {
                  choices: ['Yes, it is.', 'Yes, this.', 'It your handbag.'],
                },
                answerKey: { choice: 'Yes, it is.' },
                scoringConfig: { maxScore: 1 },
                sortOrder: 5,
              },
            ],
          },
          {
            lessonNumber: 2,
            title: 'Is This Your...?',
            lessonText:
              'Students extend the Lesson 1 dialogue with pen, pencil, book, watch, and coat. The lesson connects object vocabulary with short written transformations and a controlled dictation.',
            mediaJson: {
              audio: [
                {
                  label: 'dictation',
                  objectKey: 'nce/book1/lesson2/dictation.mp3',
                },
              ],
            },
            teacherNotes:
              'Use real objects for substitution drills before moving to written production.',
            sortOrder: 2,
            status: NcePublishStatus.published,
            publishedAt,
            objectives: [
              {
                code: 'nce-b1-u1-l2-objects',
                title: 'Recognize classroom object nouns',
                category: 'vocabulary',
                description:
                  'Students can identify common classroom and personal items.',
                masteryThreshold: 75,
                sortOrder: 1,
              },
              {
                code: 'nce-b1-u1-l2-production',
                title: 'Produce short ownership exchanges',
                category: 'writing',
                description:
                  'Students can write short exchanges using this, your, and it is.',
                masteryThreshold: 80,
                sortOrder: 2,
              },
            ],
            exercises: [
              {
                objectiveCode: 'nce-b1-u1-l2-objects',
                exerciseType: NceExerciseType.reading,
                prompt: 'Read the mini-dialogue and identify the object.',
                content: {
                  text: 'Is this your watch? Yes, it is.',
                  question: 'What object is mentioned?',
                },
                answerKey: { answer: 'watch' },
                scoringConfig: { maxScore: 1, caseInsensitive: true },
                sortOrder: 1,
              },
              {
                objectiveCode: 'nce-b1-u1-l2-production',
                exerciseType: NceExerciseType.writing,
                prompt: 'Write a two-line dialogue using the word pencil.',
                content: { requiredWords: ['pencil', 'your'], lineCount: 2 },
                answerKey: { sample: ['Is this your pencil?', 'Yes, it is.'] },
                scoringConfig: { rubricPoints: 2, maxScore: 2 },
                sortOrder: 2,
              },
              {
                objectiveCode: 'nce-b1-u1-l2-production',
                exerciseType: NceExerciseType.translation,
                prompt: 'Translate the ownership question into English.',
                content: {
                  sourceLanguage: 'vi',
                  sourceText: 'Day co phai la but chi cua ban khong?',
                },
                answerKey: { accepted: ['Is this your pencil?'] },
                scoringConfig: { maxScore: 1, caseInsensitive: true },
                sortOrder: 3,
              },
              {
                objectiveCode: 'nce-b1-u1-l2-objects',
                exerciseType: NceExerciseType.dictation,
                prompt: 'Listen and type the sentence.',
                content: { audioKey: 'nce/book1/lesson2/dictation.mp3' },
                answerKey: { sentence: 'Is this your book?' },
                scoringConfig: { maxScore: 1, punctuationOptional: true },
                sortOrder: 4,
              },
              {
                objectiveCode: 'nce-b1-u1-l2-production',
                exerciseType: NceExerciseType.gap_fill,
                prompt: 'Fill the gap: ___ this your coat?',
                content: { sentence: '___ this your coat?', blanks: ['___'] },
                answerKey: { blanks: ['Is'] },
                scoringConfig: { pointsPerBlank: 1, maxScore: 1 },
                sortOrder: 5,
              },
            ],
          },
        ],
      },
    ],
  },
]
