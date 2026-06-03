import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  calculateIeltsBandFromScores,
  getIeltsManualGradeCriteria,
  isValidIeltsBandScore,
} from '../src/features/assignments/components/teacherGrade.logic';

test('writing assignments use official IELTS writing grading criteria', () => {
  const criteria = getIeltsManualGradeCriteria('writing');

  assert.deepEqual(
    criteria.map(item => item.label),
    [
      'Task Achievement / Task Response',
      'Coherence and Cohesion',
      'Lexical Resource',
      'Grammatical Range and Accuracy',
    ],
  );
  assert.equal(criteria.every(item => item.max === 9 && item.step === 0.5), true);
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

test('IELTS band controls only accept half-step band values', () => {
  assert.equal(isValidIeltsBandScore(6.5), true);
  assert.equal(isValidIeltsBandScore(6.25), false);
  assert.equal(isValidIeltsBandScore(9.5), false);
});
