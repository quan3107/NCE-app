/**
 * Location: tests/contactForm.test.ts
 * Purpose: Define Unicode character boundaries for contact form validation.
 * Why: Client validation must interpret OpenAPI minLength/maxLength as code points.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { validateCanonicalContact } from '../src/features/marketing/contactForm';

const validPayload = {
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  subject: 'Course access',
  message: 'Please help me access my course.',
  website: '',
};

test('rejects astral text below documented code-point minimums', () => {
  const errors = validateCanonicalContact({
    ...validPayload,
    name: '😀',
    subject: '😀😀',
    message: '😀'.repeat(9),
  });

  assert.ok(errors.name);
  assert.ok(errors.subject);
  assert.ok(errors.message);
});

test('accepts astral text at documented code-point maximums', () => {
  const errors = validateCanonicalContact({
    ...validPayload,
    name: '😀'.repeat(120),
    subject: '😀'.repeat(160),
    message: '😀'.repeat(5_000),
  });

  assert.deepEqual(errors, {});
});

test('rejects astral text above documented code-point maximums', () => {
  const errors = validateCanonicalContact({
    ...validPayload,
    name: '😀'.repeat(121),
    subject: '😀'.repeat(161),
    message: '😀'.repeat(5_001),
  });

  assert.ok(errors.name);
  assert.ok(errors.subject);
  assert.ok(errors.message);
});
