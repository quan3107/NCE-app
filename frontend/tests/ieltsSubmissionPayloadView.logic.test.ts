/// <reference lib="dom" />
/**
 * Location: tests/ieltsSubmissionPayloadView.logic.test.ts
 * Purpose: Validate readable IELTS submission payload display models.
 * Why: Protects teacher and student review views from empty structured payload panels.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildIeltsSubmissionDisplay } from '../src/features/assignments/components/IeltsSubmissionPayloadView.logic';

test('buildIeltsSubmissionDisplay renders IELTS writing task responses with prompts', () => {
  const display = buildIeltsSubmissionDisplay({
    type: 'writing',
    assignmentConfig: {
      version: 1,
      task1: { prompt: '<p>Describe <strong>the chart</strong>.</p>' },
      task2: { prompt: 'Discuss both views.' },
    },
    payload: {
      version: 1,
      attempt: 2,
      durationSeconds: 754,
      task1: {
        taskId: 'task1',
        text: 'The chart shows a steady increase in applications.',
      },
      task2: {
        taskId: 'task2',
        text: 'Both views have merit, but balance is important.',
      },
    },
  });

  assert.deepEqual(display.metadata, [
    { label: 'Attempt', value: '2' },
    { label: 'Payload version', value: '1' },
    { label: 'Duration', value: '12m 34s' },
  ]);
  assert.deepEqual(display.sections, [
    {
      title: 'Task 1',
      prompt: 'Describe the chart.',
      text: 'The chart shows a steady increase in applications.',
    },
    {
      title: 'Task 2',
      prompt: 'Discuss both views.',
      text: 'Both views have merit, but balance is important.',
    },
  ]);
  assert.equal(display.fallback, undefined);
});

test('buildIeltsSubmissionDisplay renders matching answer option labels', () => {
  const display = buildIeltsSubmissionDisplay({
    type: 'reading',
    assignmentConfig: {
      version: 1,
      sections: [
        {
          id: 'section-1',
          title: 'Headings',
          passage: 'A passage.',
          questions: [
            {
              id: 'heading-match',
              type: 'matching',
              prompt: 'Choose the correct heading.',
              options: [],
              correctAnswer: '',
              matchingOptions: [
                { id: 'h1', label: 'Heading 1' },
                { id: 'h2', label: 'Heading 2' },
              ],
              matchingItems: [{ id: 'paragraph-a', statement: 'Paragraph A' }],
            },
          ],
        },
      ],
    },
    payload: {
      version: 1,
      answers: [{ questionId: 'paragraph-a', value: 'h1' }],
    },
  });

  assert.deepEqual(display.sections, [
    {
      title: 'Headings',
      rows: [{ label: 'Paragraph A', value: 'Heading 1' }],
    },
  ]);
});

test('buildIeltsSubmissionDisplay returns intentional fallback for unsupported IELTS payloads', () => {
  const display = buildIeltsSubmissionDisplay({
    type: 'writing',
    assignmentConfig: {
      version: 1,
      task1: { prompt: 'Task 1 prompt.' },
      task2: { prompt: 'Task 2 prompt.' },
    },
    payload: {
      version: 1,
      artifact: { fileId: 'legacy-file' },
      resources: [],
    },
  });

  assert.deepEqual(display.sections, []);
  assert.equal(
    display.fallback,
    'Submitted IELTS payload does not include displayable response content.',
  );
});

test('buildIeltsSubmissionDisplay groups reading answers by section when config is available', () => {
  const display = buildIeltsSubmissionDisplay({
    type: 'reading',
    assignmentConfig: {
      version: 1,
      sections: [
        {
          id: 'section-1',
          title: 'Passage 1',
          passage: 'A passage.',
          questions: [
            {
              id: 'q-1',
              type: 'short_answer',
              prompt: 'What changed?',
              options: [],
              correctAnswer: 'demand',
            },
          ],
        },
      ],
    },
    payload: {
      version: 1,
      answers: [{ questionId: 'q-1', value: 'Demand increased.' }],
    },
  });

  assert.deepEqual(display.sections, [
    {
      title: 'Passage 1',
      rows: [{ label: 'What changed?', value: 'Demand increased.' }],
    },
  ]);
});
