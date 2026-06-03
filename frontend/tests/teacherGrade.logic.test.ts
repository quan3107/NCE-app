import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  calculateIeltsBandFromScores,
  getIeltsManualGradeCriteria,
  isValidIeltsBandScore,
} from '../src/features/assignments/components/teacherGrade.logic';

test('full IELTS writing assignments use task-scoped grading criteria', () => {
  const criteria = getIeltsManualGradeCriteria('writing', {
    task1: { prompt: 'Summarise the chart.' },
    task2: { prompt: 'Discuss both views.' },
  });

  assert.deepEqual(
    criteria.map(item => item.label),
    [
      'Task 1 - Task Achievement',
      'Task 1 - Coherence and Cohesion',
      'Task 1 - Lexical Resource',
      'Task 1 - Grammatical Range and Accuracy',
      'Task 2 - Task Response',
      'Task 2 - Coherence and Cohesion',
      'Task 2 - Lexical Resource',
      'Task 2 - Grammatical Range and Accuracy',
    ],
  );
  assert.equal(criteria.every(item => item.max === 9 && item.step === 0.5), true);
  assert.deepEqual(
    criteria.map(item => item.payloadCriterion),
    [
      'Task 1 - Task Achievement',
      'Task 1 - Coherence and Cohesion',
      'Task 1 - Lexical Resource',
      'Task 1 - Grammatical Range and Accuracy',
      'Task 2 - Task Response',
      'Task 2 - Coherence and Cohesion',
      'Task 2 - Lexical Resource',
      'Task 2 - Grammatical Range and Accuracy',
    ],
  );
});

test('Task 1-only IELTS writing assignments use Task Achievement criteria', () => {
  const criteria = getIeltsManualGradeCriteria('writing', {
    task1: { prompt: 'Summarise the chart.' },
  });

  assert.deepEqual(
    criteria.map(item => item.label),
    [
      'Task Achievement',
      'Coherence and Cohesion',
      'Lexical Resource',
      'Grammatical Range and Accuracy',
    ],
  );
});

test('Task 2-only IELTS writing assignments use Task Response criteria', () => {
  const criteria = getIeltsManualGradeCriteria('writing', {
    task2: { prompt: 'Discuss both views.' },
  });

  assert.deepEqual(
    criteria.map(item => item.label),
    [
      'Task Response',
      'Coherence and Cohesion',
      'Lexical Resource',
      'Grammatical Range and Accuracy',
    ],
  );
});

test('speaking assignments use official IELTS speaking grading criteria', () => {
  const criteria = getIeltsManualGradeCriteria('speaking');

  assert.deepEqual(
    criteria.map(item => item.label),
    [
      'Fluency and Coherence',
      'Lexical Resource',
      'Grammatical Range and Accuracy',
      'Pronunciation',
    ],
  );
});

test('IELTS criterion scores average to the nearest half band', () => {
  const criteria = getIeltsManualGradeCriteria('speaking');
  const scores = {
    fluencyAndCoherence: 6.5,
    lexicalResource: 7,
    grammaticalRangeAndAccuracy: 7.5,
    pronunciation: 7,
  };

  assert.equal(calculateIeltsBandFromScores(criteria, scores), 7);
});

test('IELTS writing band weights Task 2 twice as much as Task 1', () => {
  const criteria = getIeltsManualGradeCriteria('writing', {
    task1: { prompt: 'Summarise the chart.' },
    task2: { prompt: 'Discuss both views.' },
  });
  const scores = {
    task1TaskAchievement: 5,
    task1CoherenceAndCohesion: 5,
    task1LexicalResource: 5,
    task1GrammaticalRangeAndAccuracy: 5,
    task2TaskResponse: 8,
    task2CoherenceAndCohesion: 8,
    task2LexicalResource: 8,
    task2GrammaticalRangeAndAccuracy: 8,
  };

  assert.equal(calculateIeltsBandFromScores(criteria, scores), 7);
});

test('IELTS band controls only accept half-step band values', () => {
  assert.equal(isValidIeltsBandScore(6.5), true);
  assert.equal(isValidIeltsBandScore(6.25), false);
  assert.equal(isValidIeltsBandScore(9.5), false);
});
