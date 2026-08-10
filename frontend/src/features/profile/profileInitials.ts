/**
 * Location: features/profile/profileInitials.ts
 * Purpose: Derive compact initials from Unicode display names.
 * Why: Profile avatars must never split accepted grapheme clusters.
 */

import { splitGraphemes } from "unicode-segmenter/grapheme";

function firstGrapheme(value: string): string {
  return splitGraphemes(value).next().value ?? "";
}

export function getProfileInitials(fullName: string): string {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .map(firstGrapheme)
    .join("");
}
