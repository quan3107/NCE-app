/// <reference lib="dom" />
/**
 * Location: tests/ieltsNormalization.test.ts
 * Purpose: Validate IELTS config normalization behavior for legacy boolean answer tokens.
 * Why: Keeps editor values compatible when old configs store "not given" with spaces.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { normalizeIeltsAssignmentConfig } from '../src/lib/ielts';

test('normalizeIeltsAssignmentConfig canonicalizes legacy "not given" to "not_given"', () => {
  const normalized = normalizeIeltsAssignmentConfig('reading', {
    version: 1,
    sections: [
      {
        id: 'section-1',
        title: 'Passage 1',
        passage: 'Text',
        questions: [
          {
            id: 'q-1',
            type: 'true_false_not_given',
            prompt: 'Question',
            options: [],
            correctAnswer: 'not given',
          },
          {
            id: 'q-2',
            type: 'yes_no_not_given',
            prompt: 'Question 2',
            options: [],
            correctAnswer: 'not_given',
          },
        ],
      },
    ],
  });

  assert.equal(normalized.sections[0].questions[0].correctAnswer, 'not_given');
  assert.equal(normalized.sections[0].questions[1].correctAnswer, 'not_given');
});
