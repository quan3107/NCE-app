/**
 * Location: src/lib/ielts/text.ts
 * Purpose: Provide small text helpers used by IELTS authoring forms.
 * Why: Keeps word-limit behavior reusable without coupling it to config normalization.
 */

import { stripHtml } from '../rich-text';

export const countWords = (text: string | undefined | null): number => {
  if (!text || text.trim() === '') return 0;
  const plainText = stripHtml(text);
  return plainText.trim().split(/\s+/).filter(w => w.length > 0).length;
};

export const isWithinWordLimit = (text: string | undefined | null, max = 1000): boolean => {
  return countWords(text) <= max;
};
