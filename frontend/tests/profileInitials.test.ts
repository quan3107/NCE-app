/**
 * Location: tests/profileInitials.test.ts
 * Purpose: Verify profile initials preserve complete Unicode grapheme clusters.
 * Why: Accepted names must remain renderable with or without Intl.Segmenter.
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

test("preserves graphemes when Intl.Segmenter is unavailable", async () => {
  const descriptor = Object.getOwnPropertyDescriptor(Intl, "Segmenter");
  Object.defineProperty(Intl, "Segmenter", {
    configurable: true,
    value: undefined,
  });

  try {
    const moduleURL = new URL(
      "../src/features/profile/profileInitials.ts?without-segmenter",
      import.meta.url,
    ).href;
    const fallbackModule = (await import(moduleURL)) as {
      getProfileInitials: (fullName: string) => string;
    };

    assert.equal(fallbackModule.getProfileInitials("🇻🇳 Nguyễn"), "🇻🇳N");
    assert.equal(
      fallbackModule.getProfileInitials("N\u0303guyen 👩‍💻"),
      "N\u0303👩‍💻",
    );
    assert.equal(fallbackModule.getProfileInitials("क्ष"), "क्ष");
    assert.equal(fallbackModule.getProfileInitials("가"), "가");
    assert.equal(fallbackModule.getProfileInitials("؀A"), "؀A");
  } finally {
    if (descriptor) {
      Object.defineProperty(Intl, "Segmenter", descriptor);
    } else {
      delete (Intl as { Segmenter?: unknown }).Segmenter;
    }
  }
});
