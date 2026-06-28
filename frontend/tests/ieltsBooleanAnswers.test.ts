/**
 * Location: tests/ieltsBooleanAnswers.test.ts
 * Purpose: Verify IELTS boolean answer select state.
 * Why: Prevents controls from displaying a server option when the saved answer is blank.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { getBooleanAnswerSelectValue } from '../src/features/assignments/components/ielts/questionEditor.logic';

const trueFalseOptions = [
  { value: 'true', label: 'True' },
  { value: 'false', label: 'False' },
  { value: 'not_given', label: 'Not Given' },
];

test('blank boolean answer has no selected option', () => {
  assert.equal(getBooleanAnswerSelectValue('', trueFalseOptions), undefined);
});

test('legacy boolean answer value normalizes to a configured option', () => {
  assert.equal(getBooleanAnswerSelectValue('not given', trueFalseOptions), 'not_given');
});
