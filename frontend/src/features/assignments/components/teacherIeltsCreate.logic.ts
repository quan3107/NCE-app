/**
 * Location: features/assignments/components/teacherIeltsCreate.logic.ts
 * Purpose: Keep IELTS assignment creation draft and config-shape helpers outside the route.
 * Why: Reduces page component size while preserving the authoring workflow behavior.
 */

import type {
  IeltsAssignmentConfig,
  IeltsAssignmentType,
  IeltsListeningConfig,
  IeltsReadingConfig,
  IeltsSpeakingConfig,
  IeltsWritingConfig,
} from '@lib/ielts';
import { uploadFileWithProgress } from '@features/files/fileUpload';

export type UploadMap = Record<string, File | null>;

type RestoredDraft = {
  type: IeltsAssignmentType;
  data: {
    selectedType?: IeltsAssignmentType;
    assignmentConfig?: IeltsAssignmentConfig;
    assignmentTitle?: string;
    courseId?: string;
    instructions?: string;
    timingEnabled?: boolean;
    durationMinutes?: number;
    enforceTime?: boolean;
    dueDate?: string;
  };
  timestamp: number;
};

export const isReadingConfig = (
  config: IeltsAssignmentConfig | null,
): config is IeltsReadingConfig => {
  if (!config || !('sections' in config) || !Array.isArray(config.sections)) {
    return false;
  }
  return (
    config.sections.length > 0 &&
    config.sections.every((section) => typeof (section as IeltsReadingConfig['sections'][0]).passage === 'string')
  );
};

export const isListeningConfig = (
  config: IeltsAssignmentConfig | null,
): config is IeltsListeningConfig => {
  if (!config || !('sections' in config) || !Array.isArray(config.sections)) {
    return false;
  }
  return config.sections.length > 0 && config.sections.every((section) => 'audioFileId' in section);
};

export const isWritingConfig = (
  config: IeltsAssignmentConfig | null,
): config is IeltsWritingConfig => {
  if (!config || !('task1' in config) || !('task2' in config)) {
    return false;
  }
  return typeof config.task1 === 'object' && typeof config.task2 === 'object';
};

export const isSpeakingConfig = (
  config: IeltsAssignmentConfig | null,
): config is IeltsSpeakingConfig => {
  if (!config || !('part1' in config) || !('part2' in config) || !('part3' in config)) {
    return false;
  }
  return typeof config.part1 === 'object' && typeof config.part2 === 'object' && typeof config.part3 === 'object';
};

const isFreshDraft = (timestamp: number) => {
  const maxAgeMs = 7 * 24 * 60 * 60 * 1000;
  return Date.now() - timestamp <= maxAgeMs;
};

const parseDraft = (saved: string | null): RestoredDraft | null => {
  if (!saved) {
    return null;
  }

  const parsed = JSON.parse(saved);
  if (!parsed?.timestamp || !isFreshDraft(parsed.timestamp) || !parsed.data?.selectedType) {
    return null;
  }

  return {
    type: parsed.data.selectedType,
    data: parsed.data,
    timestamp: parsed.timestamp,
  };
};

export function getInitialStateFromDraft(): RestoredDraft | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const possibleTypes: IeltsAssignmentType[] = ['reading', 'listening', 'writing', 'speaking'];
    let foundDraft: RestoredDraft | null = null;

    for (const type of possibleTypes) {
      const draft = parseDraft(localStorage.getItem(`ielts_autosave_ielts_${type}`));
      if (draft?.type === type && (!foundDraft || draft.timestamp > foundDraft.timestamp)) {
        foundDraft = draft;
      }
    }

    const createDraft = parseDraft(localStorage.getItem('ielts_autosave_ielts_create'));
    if (createDraft && (!foundDraft || createDraft.timestamp > foundDraft.timestamp)) {
      foundDraft = createDraft;
    }

    return foundDraft;
  } catch (error) {
    console.error('Error reading draft from localStorage:', error);
    return null;
  }
}

export function formatTimeAgo(date: Date): string {
  const diffSecs = Math.floor((Date.now() - date.getTime()) / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) {
    return 'just now';
  }
  if (diffMins < 60) {
    return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
  }
  if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  }
  if (diffDays < 7) {
    return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  }
  return date.toLocaleDateString();
}

export async function uploadListeningAudioFiles(
  config: IeltsAssignmentConfig,
  selectedType: IeltsAssignmentType,
  listeningFiles: UploadMap,
): Promise<IeltsAssignmentConfig> {
  if (selectedType !== 'listening' || !isListeningConfig(config)) {
    return config;
  }

  const sections = await Promise.all(
    config.sections.map(async (section) => {
      const file = listeningFiles[section.id];
      if (!file) {
        return section;
      }

      const uploaded = await uploadFileWithProgress({
        file,
        onProgress: () => undefined,
      });
      return { ...section, audioFileId: uploaded.id };
    }),
  );

  return { ...config, sections };
}

export async function uploadWritingTaskImage(
  config: IeltsAssignmentConfig,
  selectedType: IeltsAssignmentType,
  writingTask1File: File | null,
): Promise<IeltsAssignmentConfig> {
  if (selectedType !== 'writing' || !writingTask1File || !isWritingConfig(config)) {
    return config;
  }

  const uploaded = await uploadFileWithProgress({
    file: writingTask1File,
    onProgress: () => undefined,
  });

  return {
    ...config,
    task1: {
      ...config.task1,
      imageFileId: uploaded.id,
    },
  };
}
