/**
 * Location: features/profile/profileInitials.ts
 * Purpose: Derive compact initials from Unicode display names.
 * Why: Profile avatars must never split accepted astral code points.
 */

export function getProfileInitials(fullName: string): string {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((part) => Array.from(part)[0] ?? "")
    .join("");
}
