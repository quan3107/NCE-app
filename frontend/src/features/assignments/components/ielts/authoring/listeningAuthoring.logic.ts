/**
 * Location: features/assignments/components/ielts/authoring/listeningAuthoring.logic.ts
 * Purpose: Keep listening authoring helpers separate from React rendering.
 * Why: Lets the main listening form stay focused on state orchestration.
 */

import type { IeltsListeningConfig, IeltsQuestion } from '@lib/ielts';
import { createIeltsAssignmentConfig } from '@lib/ielts';

type ListeningSection = IeltsListeningConfig['sections'][number];

export const createListeningAuthoringId = () =>
  globalThis.crypto?.randomUUID?.() ?? `listening-${Date.now()}-${Math.random()}`;

export const toPlaybackSelectValue = (limitPlays?: number) =>
  limitPlays === 0 ? '999' : String(limitPlays ?? 1);

export const toPlaybackLimit = (value: string) => (value === '999' ? 0 : Number(value));

export const createListeningQuestion = (): IeltsQuestion => {
  const baseConfig = createIeltsAssignmentConfig('listening') as IeltsListeningConfig;
  const baseSection = baseConfig.sections[0];

  return {
    ...baseSection.questions[0],
    id: createListeningAuthoringId(),
    type: 'multiple_choice',
    prompt: '',
    options: ['', '', '', ''],
    correctAnswer: '',
  };
};

export const matchFileToListeningSection = (
  filename: string,
  sections: ListeningSection[],
): string | null => {
  const lowerName = filename.toLowerCase();

  // Match common teacher file naming styles such as section_1, part-2, or s3.
  for (let i = 1; i <= 4; i += 1) {
    const patterns = [
      `section${i}`,
      `section_${i}`,
      `section-${i}`,
      `section ${i}`,
      `part${i}`,
      `part_${i}`,
      `part-${i}`,
      `part ${i}`,
      `s${i}`,
      `p${i}`,
      `${i}`,
    ];

    const hasPattern = patterns.some((pattern) => lowerName.includes(pattern));
    const sectionIndex = i - 1;

    if (hasPattern && sectionIndex < sections.length) {
      return sections[sectionIndex].id;
    }
  }

  return null;
};

export const createBulkAudioMatches = (
  files: File[],
  sections: ListeningSection[],
): Record<string, File | null> => {
  const matches: Record<string, File | null> = Object.fromEntries(
    sections.map((section) => [section.id, null]),
  );

  files.forEach((file) => {
    const sectionId = matchFileToListeningSection(file.name, sections);
    if (sectionId && !matches[sectionId]) {
      matches[sectionId] = file;
    }
  });

  return matches;
};
