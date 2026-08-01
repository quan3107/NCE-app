/**
 * Location: features/profile/profileInitials.ts
 * Purpose: Derive compact initials from Unicode display names.
 * Why: Profile avatars must never split accepted grapheme clusters.
 */

type GraphemeSegmenter = {
  segment: (value: string) => Iterable<{ segment: string }>;
};

type GraphemeSegmenterConstructor = new (
  locales?: string | string[],
  options?: { granularity: "grapheme" },
) => GraphemeSegmenter;

const Segmenter = (
  Intl as unknown as {
    Segmenter?: GraphemeSegmenterConstructor;
  }
).Segmenter;
const graphemeSegmenter =
  typeof Segmenter === "function"
    ? new Segmenter(undefined, { granularity: "grapheme" })
    : null;
const COMBINING_MARK_PATTERN = /\p{M}/u;
const ZERO_WIDTH_JOINER = "\u200d";

function isRegionalIndicator(value: string): boolean {
  const codePoint = value.codePointAt(0) ?? 0;
  return codePoint >= 0x1f1e6 && codePoint <= 0x1f1ff;
}

function isGraphemeExtension(value: string): boolean {
  const codePoint = value.codePointAt(0) ?? 0;
  return (
    COMBINING_MARK_PATTERN.test(value) ||
    (codePoint >= 0xfe00 && codePoint <= 0xfe0f) ||
    (codePoint >= 0x1f3fb && codePoint <= 0x1f3ff) ||
    (codePoint >= 0xe0020 && codePoint <= 0xe007f) ||
    (codePoint >= 0xe0100 && codePoint <= 0xe01ef)
  );
}

function fallbackFirstGrapheme(value: string): string {
  const codePoints = Array.from(value);
  if (codePoints.length === 0) {
    return "";
  }
  if (codePoints[0] === "\r" && codePoints[1] === "\n") {
    return "\r\n";
  }
  if (
    isRegionalIndicator(codePoints[0]) &&
    isRegionalIndicator(codePoints[1] ?? "")
  ) {
    return codePoints.slice(0, 2).join("");
  }

  let end = 1;
  while (end < codePoints.length) {
    if (isGraphemeExtension(codePoints[end])) {
      end += 1;
      continue;
    }
    if (codePoints[end] === ZERO_WIDTH_JOINER && end + 1 < codePoints.length) {
      end += 2;
      continue;
    }
    break;
  }
  return codePoints.slice(0, end).join("");
}

function firstGrapheme(value: string): string {
  if (graphemeSegmenter) {
    for (const segment of graphemeSegmenter.segment(value)) {
      return segment.segment;
    }
  }
  return fallbackFirstGrapheme(value);
}

export function getProfileInitials(fullName: string): string {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .map(firstGrapheme)
    .join("");
}
