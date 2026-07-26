/**
 * Location: tests/assignmentDateTime.logic.test.ts
 * Purpose: Verify assignment due dates round-trip through datetime-local controls.
 * Why: UTC formatting in a local-time input shifts unchanged deadlines on every save.
 */
import assert from 'node:assert/strict';
import { after, test } from 'node:test';

import {
  fromDateTimeLocalValue,
  toDateTimeLocalValue,
} from '../src/features/assignments/assignmentDateTime.logic';

const originalTimezone = process.env.TZ;
process.env.TZ = 'Asia/Ho_Chi_Minh';

after(() => {
  if (originalTimezone === undefined) {
    delete process.env.TZ;
  } else {
    process.env.TZ = originalTimezone;
  }
});

test('toDateTimeLocalValue displays an instant in the browser local timezone', () => {
  const dueAt = new Date('2026-07-25T14:17:00.000Z');

  assert.equal(toDateTimeLocalValue(dueAt), '2026-07-25T21:17');
});

test('an unchanged datetime-local value preserves the original instant', () => {
  const dueAt = new Date('2026-07-25T14:17:00.000Z');

  const submitted = fromDateTimeLocalValue(toDateTimeLocalValue(dueAt), dueAt);

  assert.equal(submitted.toISOString(), dueAt.toISOString());
});

test('an unchanged repeated DST time preserves the original occurrence', () => {
  process.env.TZ = 'America/New_York';
  try {
    const dueAt = new Date('2026-11-01T06:30:00.000Z');
    const controlValue = toDateTimeLocalValue(dueAt);

    assert.equal(controlValue, '2026-11-01T01:30');
    assert.equal(new Date(controlValue).toISOString(), '2026-11-01T05:30:00.000Z');
    assert.equal(
      fromDateTimeLocalValue(controlValue, dueAt).toISOString(),
      dueAt.toISOString(),
    );
  } finally {
    process.env.TZ = 'Asia/Ho_Chi_Minh';
  }
});

test('an unchanged minute-only value preserves seconds and milliseconds', () => {
  process.env.TZ = 'UTC';
  try {
    const dueAt = new Date('2026-07-25T14:17:42.123Z');
    const controlValue = toDateTimeLocalValue(dueAt);

    assert.equal(controlValue, '2026-07-25T14:17');
    assert.equal(
      fromDateTimeLocalValue(controlValue, dueAt).toISOString(),
      dueAt.toISOString(),
    );
  } finally {
    process.env.TZ = 'Asia/Ho_Chi_Minh';
  }
});
