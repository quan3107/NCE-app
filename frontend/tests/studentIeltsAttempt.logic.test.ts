/// <reference lib="dom" />
/**
 * Location: tests/studentIeltsAttempt.logic.test.ts
 * Purpose: Validate student IELTS attempt payload serialization.
 * Why: Protects the student-facing IELTS submission contract before UI wiring.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  buildStudentIeltsPayload,
  createInitialStudentIeltsAttempt,
  getStudentIeltsAttemptAvailability,
  hasStudentIeltsSubmissionContent,
  type StudentIeltsAttemptState,
} from '../src/features/assignments/components/ielts/student/studentIeltsAttempt.logic';
import { createStudentIeltsAttemptFromPayload } from '../src/features/assignments/components/ielts/student/studentIeltsAttemptHydration';
import type {
  IeltsReadingConfig,
  IeltsSpeakingConfig,
  IeltsWritingConfig,
} from '../src/lib/ielts';

const startedAt = '2026-02-01T10:00:00.000Z';
const submittedAt = '2026-02-01T10:12:34.000Z';

const readingConfig: IeltsReadingConfig = {
  version: 1,
  instructions: 'Read the passage and answer the questions.',
  timing: { enabled: true, durationMinutes: 60, enforce: true },
  attempts: { maxAttempts: 2 },
  sections: [
    {
      id: 'section-1',
      title: 'Passage 1',
      passage: 'A reading passage.',
      questions: [
        {
          id: 'q-1',
          type: 'multiple_choice',
          prompt: 'Choose one.',
          options: ['A', 'B'],
          correctAnswer: 'A',
        },
        {
          id: 'q-2',
          type: 'short_answer',
          prompt: 'Write a short answer.',
          options: [],
          correctAnswer: 'answer',
        },
      ],
    },
  ],
};

test('buildStudentIeltsPayload serializes reading option text by scorer question id with timing metadata', () => {
  const state: StudentIeltsAttemptState = {
    ...createInitialStudentIeltsAttempt(startedAt),
    answers: {
      'q-1': '1',
      'q-2': 'A concise answer',
      'unknown-question': 'ignored',
    },
  };

  const payload = buildStudentIeltsPayload({
    type: 'reading',
    config: readingConfig,
    attempt: 2,
    state,
    submittedAt,
  });

  assert.deepEqual(payload, {
    version: 1,
    attempt: 2,
    startedAt,
    submittedAt,
    durationSeconds: 754,
    answers: [
      { questionId: 'q-1', value: 'B' },
      { questionId: 'q-2', value: 'A concise answer' },
    ],
  });
});

test('buildStudentIeltsPayload serializes nested answer targets for compound questions', () => {
  const config: IeltsReadingConfig = {
    ...readingConfig,
    sections: [
      {
        ...readingConfig.sections[0],
        questions: [
          {
            id: 'matching-group',
            type: 'matching',
            prompt: 'Match each item.',
            options: [],
            correctAnswer: '',
            items: [
              { id: 'item-1', prompt: 'First item', answer: 'Alpha' },
              { id: 'item-2', prompt: 'Second item', answer: 'Beta' },
            ],
          } as IeltsReadingConfig['sections'][number]['questions'][number],
        ],
      },
    ],
  };
  const state: StudentIeltsAttemptState = {
    ...createInitialStudentIeltsAttempt(startedAt),
    answers: {
      'matching-group': 'ignored group answer',
      'item-1': 'Alpha',
      'item-2': 'Beta',
    },
  };

  const payload = buildStudentIeltsPayload({
    type: 'reading',
    config,
    attempt: 1,
    state,
    submittedAt,
  });

  assert.deepEqual((payload as { answers: unknown }).answers, [
    { questionId: 'item-1', value: 'Alpha' },
    { questionId: 'item-2', value: 'Beta' },
  ]);
});

test('buildStudentIeltsPayload serializes writing task identifiers and responses', () => {
  const config: IeltsWritingConfig = {
    version: 1,
    instructions: '',
    timing: { enabled: true, durationMinutes: 90, enforce: true },
    attempts: { maxAttempts: null },
    task1: { prompt: 'Describe the chart.' },
    task2: { prompt: 'Discuss both views.' },
  };
  const state: StudentIeltsAttemptState = {
    ...createInitialStudentIeltsAttempt(startedAt),
    writing: {
      task1: 'The chart shows steady growth.',
      task2: 'Both views have merit.',
    },
  };

  const payload = buildStudentIeltsPayload({
    type: 'writing',
    config,
    attempt: 1,
    state,
    submittedAt,
  });

  assert.deepEqual(payload, {
    version: 1,
    attempt: 1,
    startedAt,
    submittedAt,
    durationSeconds: 754,
    task1: {
      taskId: 'task1',
      text: 'The chart shows steady growth.',
    },
    task2: {
      taskId: 'task2',
      text: 'Both views have merit.',
    },
  });
});

test('buildStudentIeltsPayload serializes speaking recording metadata by part', () => {
  const config: IeltsSpeakingConfig = {
    version: 1,
    instructions: '',
    timing: { enabled: false, durationMinutes: 15, enforce: false },
    attempts: { maxAttempts: null },
    part1: { questions: ['Where do you live?'] },
    part2: {
      cueCard: {
        topic: 'Describe a useful object.',
        bulletPoints: ['what it is', 'why it is useful'],
      },
      prepSeconds: 60,
      talkSeconds: 120,
    },
    part3: { questions: ['How has technology changed daily life?'] },
  };
  const state: StudentIeltsAttemptState = {
    ...createInitialStudentIeltsAttempt(startedAt),
    speakingRecordings: {
      part1: {
        id: '3f2ea321-b104-4ecf-ae60-f7cbaf1f8861',
        durationSeconds: 45,
      },
      part3: {
        id: 'd8d96975-d178-4cb5-af61-cfa98a58a143',
        durationSeconds: 75,
      },
    },
  };

  const payload = buildStudentIeltsPayload({
    type: 'speaking',
    config,
    attempt: 1,
    state,
    submittedAt,
  });

  assert.deepEqual(payload.recordings, [
    {
      part: 'part1',
      fileId: '3f2ea321-b104-4ecf-ae60-f7cbaf1f8861',
      durationSeconds: 45,
    },
    {
      part: 'part3',
      fileId: 'd8d96975-d178-4cb5-af61-cfa98a58a143',
      durationSeconds: 75,
    },
  ]);
});

test('createStudentIeltsAttemptFromPayload recovers IELTS draft answers', () => {
  const state = createStudentIeltsAttemptFromPayload('writing', {
    version: 1,
    startedAt,
    task1: { taskId: 'task1', text: 'Draft task one.' },
    task2: { taskId: 'task2', text: 'Draft task two.' },
  });

  assert.deepEqual(state, {
    startedAt,
    answers: {},
    writing: {
      task1: 'Draft task one.',
      task2: 'Draft task two.',
    },
    speakingRecordings: {},
    notes: {},
  });
});

test('hasStudentIeltsSubmissionContent distinguishes empty drafts from submit-ready attempts', () => {
  const emptyAttempt = createInitialStudentIeltsAttempt(startedAt);
  const answeredAttempt = {
    ...emptyAttempt,
    answers: { 'q-1': '0' },
  };

  assert.equal(hasStudentIeltsSubmissionContent('reading', readingConfig, emptyAttempt), false);
  assert.equal(hasStudentIeltsSubmissionContent('reading', readingConfig, answeredAttempt), true);
});

test('getStudentIeltsAttemptAvailability blocks resubmission after max attempts', () => {
  const availability = getStudentIeltsAttemptAvailability({
    config: readingConfig,
    existingVersion: 2,
    existingStatus: 'submitted',
  });

  assert.deepEqual(availability, {
    nextAttempt: 3,
    maxAttempts: 2,
    hasReachedMaxAttempts: true,
  });
});
