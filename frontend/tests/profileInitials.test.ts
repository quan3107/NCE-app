/**
 * Location: tests/profileInitials.test.ts
 * Purpose: Verify profile initials preserve complete Unicode code points.
 * Why: Accepted astral display names must not render lone surrogate glyphs.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { getProfileInitials } from "../src/features/profile/profileInitials";

test("extracts astral initials without splitting surrogate pairs", () => {
  const grin = String.fromCodePoint(0x1f600);
  const rocket = String.fromCodePoint(0x1f680);

  assert.equal(getProfileInitials(`${grin}${grin}`), grin);
  assert.equal(
    getProfileInitials(`${grin} ${rocket} Alpha Delta`),
    `${grin}${rocket}A`,
  );
});

test("preserves flag and decomposed grapheme clusters", () => {
  assert.equal(getProfileInitials("🇻🇳 Nguyễn"), "🇻🇳N");
  assert.equal(getProfileInitials("N\u0303guyen Van"), "N\u0303V");
});
