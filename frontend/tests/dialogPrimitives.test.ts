/// <reference lib="dom" />
/**
 * Location: tests/dialogPrimitives.test.ts
 * Purpose: Validate shared dialog primitive wrappers keep Radix ref compatibility.
 * Why: Prevents console warnings when course-management dialogs open.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { DialogContent, DialogOverlay } from '../src/components/ui/dialog';

const forwardRefType = Symbol.for('react.forward_ref');

test('dialog overlay forwards refs for Radix presence wrappers', () => {
  assert.equal(
    (DialogOverlay as unknown as { $$typeof?: symbol }).$$typeof,
    forwardRefType,
  );
});

test('dialog content forwards refs for Radix focus management', () => {
  assert.equal(
    (DialogContent as unknown as { $$typeof?: symbol }).$$typeof,
    forwardRefType,
  );
});
