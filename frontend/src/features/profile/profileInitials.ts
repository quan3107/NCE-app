/**
 * Location: features/profile/profileInitials.ts
 * Purpose: Derive compact initials from Unicode display names.
 * Why: Profile avatars must never split accepted grapheme clusters.
 */

type GraphemeSegmenter = {
  segment: (value: string) => Iterable<{ segment: string }>;
};

const Segmenter = (
  Intl as unknown as {
    Segmenter: new (
      locales?: string | string[],
      options?: { granularity: "grapheme" },
    ) => GraphemeSegmenter;
  }
).Segmenter;
const graphemeSegmenter = new Segmenter(undefined, {
  granularity: "grapheme",
});

function firstGrapheme(value: string): string {
  for (const segment of graphemeSegmenter.segment(value)) {
    return segment.segment;
  }
  return "";
}

export function getProfileInitials(fullName: string): string {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .map(firstGrapheme)
    .join("");
}
