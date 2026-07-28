/// <reference lib="dom" />
/**
 * Location: tests/dialogPrimitives.test.ts
 * Purpose: Validate shared primitive wrappers keep Radix ref compatibility.
 * Why: Radix needs stable DOM refs for presence handling and focus restoration.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Button } from '../src/components/ui/button';
import { DialogContent, DialogOverlay } from '../src/components/ui/dialog';
import * as sheetPrimitives from '../src/components/ui/sheet';

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

test('shared button forwards the trigger ref for Radix focus restoration', () => {
  assert.equal(
    (Button as unknown as { $$typeof?: symbol }).$$typeof,
    forwardRefType,
  );
});

test('sheet overlay forwards refs for Radix presence cleanup', () => {
  const sheetOverlay = Reflect.get(sheetPrimitives, 'SheetOverlay') as
    | { $$typeof?: symbol }
    | undefined;
  assert.equal(sheetOverlay?.$$typeof, forwardRefType);
});
