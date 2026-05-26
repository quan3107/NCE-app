/**
 * Location: features/assignments/components/ielts/readingContentEditor.logic.ts
 * Purpose: Create default IELTS reading sections and questions for inline editing.
 * Why: Keeps the reading content editor focused on UI state and rendering.
 */

import type { IeltsQuestion, IeltsReadingSection } from '@lib/ielts';

const createId = () => {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `ielts-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export const createReadingQuestion = (): IeltsQuestion => ({
  id: createId(),
  type: 'multiple_choice',
  prompt: '',
  options: ['', ''],
  correctAnswer: '',
});

export const createReadingSection = (index: number): IeltsReadingSection => ({
  id: createId(),
  title: `Passage ${index + 1}`,
  passage: '',
  questions: [createReadingQuestion()],
});
