/**
 * Location: src/lib/ielts.ts
 * Purpose: Define IELTS assignment config types and helpers for authoring UI.
 * Why: Keeps IELTS-specific shapes centralized and reusable across authoring flows.
 */

export type IeltsAssignmentType = 'reading' | 'listening' | 'writing' | 'speaking';

export const IELTS_ASSIGNMENT_TYPES: IeltsAssignmentType[] = [
  'reading',
  'listening',
  'writing',
  'speaking',
];

export const isIeltsAssignmentType = (value: string): value is IeltsAssignmentType =>
  IELTS_ASSIGNMENT_TYPES.includes(value as IeltsAssignmentType);

export type IeltsTimingConfig = {
  enabled: boolean;
  durationMinutes: number;
  enforce: boolean;
  startAt?: string;
  endAt?: string;
  autoSubmit?: boolean;
  rejectLateStart?: boolean;
};

export type IeltsAttemptsConfig = {
  maxAttempts: number | null;
};

/**
 * IELTS Completion Format - used by both Reading and Listening completion questions
 */
export const IELTS_COMPLETION_FORMATS: { value: IeltsCompletionFormat; label: string }[] = [
  { value: 'form', label: 'Form Completion' },
  { value: 'note', label: 'Note Completion' },
  { value: 'table', label: 'Table Completion' },
  { value: 'flow_chart', label: 'Flow Chart Completion' },
  { value: 'summary', label: 'Summary Completion' },
];

export type IeltsCompletionFormat =
  | 'form'
  | 'note'
  | 'table'
  | 'flow_chart'
  | 'summary';

/**
 * IELTS Reading Question Types (10 types)
 * Source: https://ielts.org/take-a-test/test-types/ielts-academic-test/ielts-academic-format-reading
 */
export const IELTS_READING_QUESTION_TYPES: { value: IeltsReadingQuestionType; label: string }[] = [
  { value: 'multiple_choice', label: 'Multiple Choice' },
  { value: 'true_false_not_given', label: 'True/False/Not Given' },
  { value: 'yes_no_not_given', label: 'Yes/No/Not Given' },
  { value: 'matching_headings', label: 'Matching Headings' },
  { value: 'matching_information', label: 'Matching Information' },
  { value: 'matching_features', label: 'Matching Features' },
  { value: 'sentence_completion', label: 'Sentence Completion' },
  { value: 'completion', label: 'Completion (Form/Note/Table/etc.)' },
  { value: 'diagram_labeling', label: 'Diagram Labeling' },
  { value: 'short_answer', label: 'Short Answer' },
];

export type IeltsReadingQuestionType =
  | 'multiple_choice'
  | 'true_false_not_given'
  | 'yes_no_not_given'
  | 'matching_headings'
  | 'matching_information'
  | 'matching_features'
  | 'sentence_completion'
  | 'completion'
  | 'diagram_labeling'
  | 'short_answer';

/**
 * IELTS Listening Question Types (6 types)
 * Source: https://ielts.org/take-a-test/test-types/ielts-academic-test/ielts-academic-format-listening
 */
export const IELTS_LISTENING_QUESTION_TYPES: { value: IeltsListeningQuestionType; label: string }[] = [
  { value: 'multiple_choice', label: 'Multiple Choice' },
  { value: 'matching', label: 'Matching' },
  { value: 'map_diagram_labeling', label: 'Map/Diagram Labeling' },
  { value: 'completion', label: 'Completion (Form/Note/Table/etc.)' },
  { value: 'sentence_completion', label: 'Sentence Completion' },
  { value: 'short_answer', label: 'Short Answer' },
];

export type IeltsListeningQuestionType =
  | 'multiple_choice'
  | 'matching'
  | 'map_diagram_labeling'
  | 'completion'
  | 'sentence_completion'
  | 'short_answer';

/**
 * Legacy union type for backward compatibility
 * @deprecated Use IeltsReadingQuestionType or IeltsListeningQuestionType instead
 */
export type IeltsQuestionType = IeltsReadingQuestionType | IeltsListeningQuestionType;

/**
 * IELTS Writing Task 1 Visual Types
 */
export const IELTS_WRITING_TASK1_TYPES: { value: IeltsWritingTask1Type; label: string }[] = [
  { value: 'line_graph', label: 'Line Graph' },
  { value: 'bar_chart', label: 'Bar Chart' },
  { value: 'pie_chart', label: 'Pie Chart' },
  { value: 'table', label: 'Table' },
  { value: 'diagram', label: 'Diagram' },
  { value: 'map', label: 'Map' },
  { value: 'process', label: 'Process' },
];

export type IeltsWritingTask1Type =
  | 'line_graph'
  | 'bar_chart'
  | 'pie_chart'
  | 'table'
  | 'diagram'
  | 'map'
  | 'process';

/**
 * IELTS Writing Task 2 Essay Types
 */
export const IELTS_WRITING_TASK2_TYPES: { value: IeltsWritingTask2Type; label: string }[] = [
  { value: 'opinion', label: 'Opinion Essay' },
  { value: 'discussion', label: 'Discussion Essay' },
  { value: 'problem_solution', label: 'Problem-Solution Essay' },
  { value: 'advantages_disadvantages', label: 'Advantages & Disadvantages Essay' },
  { value: 'double_question', label: 'Double Question Essay' },
];

export type IeltsWritingTask2Type =
  | 'opinion'
  | 'discussion'
  | 'problem_solution'
  | 'advantages_disadvantages'
  | 'double_question';

/**
 * IELTS Speaking Part Types
 */
export const IELTS_SPEAKING_PART_TYPES: { value: IeltsSpeakingPartType; label: string }[] = [
  { value: 'part1_personal', label: 'Part 1: Personal Questions' },
  { value: 'part2_cue_card', label: 'Part 2: Cue Card' },
  { value: 'part3_discussion', label: 'Part 3: Discussion' },
];

export type IeltsSpeakingPartType =
  | 'part1_personal'
  | 'part2_cue_card'
  | 'part3_discussion';

/**
 * Matching types for drag-and-drop matching questions
 */
export type MatchingItem = {
  id: string;
  statement: string;
  matchId: string | null;
};

export type MatchingOption = {
  id: string;
  label: string;
};

/**
 * Diagram labeling types for image-based questions
 */
export type DiagramLabel = {
  id: string;
  letter: string;
  position: string;
  answer: string;
};

/**
 * Base question interface with optional format for completion types
 */
export type IeltsQuestion = {
  id: string;
  type: IeltsQuestionType;
  prompt: string;
  options: string[];
  correctAnswer: string;
  format?: IeltsCompletionFormat;
  // Extended fields for specific question types
  matchingItems?: MatchingItem[];
  matchingOptions?: MatchingOption[];
  diagramImageIds?: string[];
  diagramLabels?: DiagramLabel[];
};

export type IeltsReadingSection = {
  id: string;
  title: string;
  passage: string;
  questions: IeltsQuestion[];
};

export type IeltsListeningSection = {
  id: string;
  title: string;
  audioFileId: string | null;
  transcript?: string;
  playback?: {
    limitPlays: number;
  };
  questions: IeltsQuestion[];
};

export type IeltsWritingTask = {
  prompt: string;
  imageFileId?: string | null;
};

export type IeltsSpeakingPart = {
  questions: string[];
};

export type IeltsAssignmentBase = {
  version: 1;
  timing: IeltsTimingConfig;
  instructions: string;
  attempts: IeltsAttemptsConfig;
};

export type IeltsReadingConfig = IeltsAssignmentBase & {
  sections: IeltsReadingSection[];
};

export type IeltsListeningConfig = IeltsAssignmentBase & {
  sections: IeltsListeningSection[];
};

export type IeltsWritingConfig = IeltsAssignmentBase & {
  task1: IeltsWritingTask;
  task2: {
    prompt: string;
  };
};

export type IeltsSpeakingConfig = IeltsAssignmentBase & {
  part1: IeltsSpeakingPart;
  part2: {
    cueCard: {
      topic: string;
      bulletPoints: string[];
    };
    prepSeconds: number;
    talkSeconds: number;
  };
  part3: IeltsSpeakingPart;
};

export type IeltsAssignmentConfig =
  | IeltsReadingConfig
  | IeltsListeningConfig
  | IeltsWritingConfig
  | IeltsSpeakingConfig;

const createId = () => {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `ielts-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

/**
 * Group questions by type while preserving relative order within each type group.
 * Used when teacher clicks "Group by Type" button in reading editor.
 * Questions maintain their original order within each type group.
 */
export function groupQuestionsByType<T extends { type: string }>(questions: T[]): T[] {
  const typeOrder: string[] = [];
  const typeMap = new Map<string, T[]>();

  // First pass: determine type order (first appearance) and collect questions
  for (const question of questions) {
    if (!typeMap.has(question.type)) {
      typeOrder.push(question.type);
      typeMap.set(question.type, []);
    }
    typeMap.get(question.type)!.push(question);
  }

  // Second pass: rebuild array in type order
  const grouped: T[] = [];
  for (const type of typeOrder) {
    grouped.push(...typeMap.get(type)!);
  }

  return grouped;
}

const baseConfig = (): IeltsAssignmentBase => ({
  version: 1,
  timing: {
    enabled: true,
    durationMinutes: 60,
    enforce: true,
  },
  instructions: '',
  attempts: {
    maxAttempts: null,
  },
});

const createQuestion = (
  type: IeltsQuestionType = 'multiple_choice',
  format?: IeltsCompletionFormat,
): IeltsQuestion => {
  const baseOptions = type === 'completion' ? ['', ''] : [''];
  const question: IeltsQuestion = {
    id: createId(),
    type,
    prompt: '',
    options: baseOptions,
    correctAnswer: '',
  };

  // Initialize format for completion types
  if (type === 'completion') {
    question.format = format || 'summary';
  }

  // Initialize matching data for matching types
  if (['matching', 'matching_headings', 'matching_information', 'matching_features'].includes(type)) {
    question.matchingItems = [
      { id: createId(), statement: '', matchId: null },
      { id: createId(), statement: '', matchId: null },
      { id: createId(), statement: '', matchId: null },
    ];
    question.matchingOptions = [
      { id: createId(), label: 'A' },
      { id: createId(), label: 'B' },
      { id: createId(), label: 'C' },
      { id: createId(), label: 'D' },
    ];
  }

  // Initialize diagram data for labeling types
  if (['map_diagram_labeling', 'diagram_labeling'].includes(type)) {
    question.diagramImageIds = [];
    question.diagramLabels = [
      { id: createId(), letter: 'A', position: '', answer: '' },
      { id: createId(), letter: 'B', position: '', answer: '' },
      { id: createId(), letter: 'C', position: '', answer: '' },
    ];
  }

  return question;
};

const createReadingSection = (index: number): IeltsReadingSection => ({
  id: createId(),
  title: `Passage ${index + 1}`,
  passage: '',
  questions: [createQuestion('multiple_choice')],
});

const createListeningSection = (index: number): IeltsListeningSection => ({
  id: createId(),
  title: `Section ${index + 1}`,
  audioFileId: null,
  transcript: '',
  playback: { limitPlays: 1 },
  questions: [createQuestion('multiple_choice')],
});

export const createIeltsAssignmentConfig = (
  type: IeltsAssignmentType,
): IeltsAssignmentConfig => {
  switch (type) {
    case 'reading':
      return {
        ...baseConfig(),
        sections: [createReadingSection(0), createReadingSection(1), createReadingSection(2)],
      };
    case 'listening':
      return {
        ...baseConfig(),
        sections: [
          createListeningSection(0),
          createListeningSection(1),
          createListeningSection(2),
          createListeningSection(3),
        ],
      };
    case 'writing':
      return {
        ...baseConfig(),
        task1: { prompt: '', imageFileId: null },
        task2: { prompt: '' },
      };
    case 'speaking':
      return {
        ...baseConfig(),
        part1: { questions: [''] },
        part2: {
          cueCard: { topic: '', bulletPoints: [''] },
          prepSeconds: 60,
          talkSeconds: 120,
        },
        part3: { questions: [''] },
      };
    default:
      return {
        ...baseConfig(),
        sections: [createReadingSection(0)],
      } as IeltsReadingConfig;
  }
};

const toNumber = (value: unknown, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const toString = (value: unknown, fallback = '') =>
  typeof value === 'string' ? value : fallback;

const toBoolean = (value: unknown, fallback: boolean) =>
  typeof value === 'boolean' ? value : fallback;

const normalizeQuestions = (value: unknown): IeltsQuestion[] => {
  if (!Array.isArray(value)) {
    return [createQuestion()];
  }

  const normalizeMatchingItem = (item: unknown): MatchingItem | null => {
    if (!item || typeof item !== 'object') return null;
    const record = item as Record<string, unknown>;
    return {
      id: toString(record.id, createId()),
      statement: toString(record.statement),
      matchId: record.matchId === null ? null : toString(record.matchId, ''),
    };
  };

  const normalizeMatchingOption = (option: unknown): MatchingOption | null => {
    if (!option || typeof option !== 'object') return null;
    const record = option as Record<string, unknown>;
    return {
      id: toString(record.id, createId()),
      label: toString(record.label),
    };
  };

  const normalizeDiagramLabel = (label: unknown): DiagramLabel | null => {
    if (!label || typeof label !== 'object') return null;
    const record = label as Record<string, unknown>;
    return {
      id: toString(record.id, createId()),
      letter: toString(record.letter),
      position: toString(record.position),
      answer: toString(record.answer),
    };
  };

  const questions = value
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null;
      }
      const record = item as Record<string, unknown>;
      const question: IeltsQuestion = {
        id: toString(record.id, createId()),
        type: (record.type as IeltsQuestionType) ?? 'multiple_choice',
        prompt: toString(record.prompt),
        options: Array.isArray(record.options)
          ? record.options.map((option) => toString(option))
          : [''],
        correctAnswer: toString(record.correctAnswer),
      };
      // Preserve format field for completion questions
      if (record.format && typeof record.format === 'string') {
        question.format = record.format as IeltsCompletionFormat;
      }
      // Preserve matching data
      if (Array.isArray(record.matchingItems)) {
        question.matchingItems = record.matchingItems
          .map(normalizeMatchingItem)
          .filter((item): item is MatchingItem => Boolean(item));
      }
      if (Array.isArray(record.matchingOptions)) {
        question.matchingOptions = record.matchingOptions
          .map(normalizeMatchingOption)
          .filter((option): option is MatchingOption => Boolean(option));
      }
      // Preserve diagram data
      if (Array.isArray(record.diagramImageIds)) {
        question.diagramImageIds = record.diagramImageIds
          .map((id) => toString(id))
          .filter((id) => id);
      }
      if (Array.isArray(record.diagramLabels)) {
        question.diagramLabels = record.diagramLabels
          .map(normalizeDiagramLabel)
          .filter((label): label is DiagramLabel => Boolean(label));
      }
      return question;
    })
    .filter((item): item is IeltsQuestion => Boolean(item));

  return questions.length ? questions : [createQuestion()];
};

const normalizeTiming = (
  value: unknown,
  fallback: IeltsTimingConfig,
): IeltsTimingConfig => {
  if (!value || typeof value !== 'object') {
    return fallback;
  }
  const record = value as Record<string, unknown>;
  return {
    enabled: toBoolean(record.enabled, fallback.enabled),
    durationMinutes: toNumber(record.durationMinutes, fallback.durationMinutes),
    enforce: toBoolean(record.enforce, fallback.enforce),
    startAt: typeof record.startAt === 'string' ? record.startAt : undefined,
    endAt: typeof record.endAt === 'string' ? record.endAt : undefined,
    autoSubmit: typeof record.autoSubmit === 'boolean' ? record.autoSubmit : undefined,
    rejectLateStart:
      typeof record.rejectLateStart === 'boolean' ? record.rejectLateStart : undefined,
  };
};

const normalizeAttempts = (
  value: unknown,
  fallback: IeltsAttemptsConfig,
): IeltsAttemptsConfig => {
  if (!value || typeof value !== 'object') {
    return fallback;
  }
  const record = value as Record<string, unknown>;
  const maxAttempts =
    typeof record.maxAttempts === 'number' && Number.isFinite(record.maxAttempts)
      ? record.maxAttempts
      : null;
  return {
    maxAttempts,
  };
};

export const normalizeIeltsAssignmentConfig = (
  type: IeltsAssignmentType,
  config: unknown,
): IeltsAssignmentConfig => {
  const base = createIeltsAssignmentConfig(type);
  if (!config || typeof config !== 'object') {
    return base;
  }

  const record = config as Record<string, unknown>;
  const normalizedBase: IeltsAssignmentBase = {
    ...base,
    timing: normalizeTiming(record.timing, base.timing),
    instructions: toString(record.instructions, base.instructions),
    attempts: normalizeAttempts(record.attempts, base.attempts),
  };

  switch (type) {
    case 'reading': {
      const sections = Array.isArray(record.sections)
        ? record.sections.map((section, index) => {
            const fallback = createReadingSection(index);
            if (!section || typeof section !== 'object') {
              return fallback;
            }
            const sectionRecord = section as Record<string, unknown>;
            return {
              ...fallback,
              id: toString(sectionRecord.id, fallback.id),
              title: toString(sectionRecord.title, fallback.title),
              passage: toString(sectionRecord.passage, fallback.passage),
              questions: normalizeQuestions(sectionRecord.questions),
            };
          })
        : (base as IeltsReadingConfig).sections;
      return {
        ...normalizedBase,
        sections: sections.length ? sections : (base as IeltsReadingConfig).sections,
      };
    }
    case 'listening': {
      const sections = Array.isArray(record.sections)
        ? record.sections.map((section, index) => {
            const fallback = createListeningSection(index);
            if (!section || typeof section !== 'object') {
              return fallback;
            }
            const sectionRecord = section as Record<string, unknown>;
            const playback =
              sectionRecord.playback && typeof sectionRecord.playback === 'object'
                ? (sectionRecord.playback as Record<string, unknown>)
                : {};
            return {
              ...fallback,
              id: toString(sectionRecord.id, fallback.id),
              title: toString(sectionRecord.title, fallback.title),
              audioFileId:
                sectionRecord.audioFileId === null
                  ? null
                  : toString(sectionRecord.audioFileId, fallback.audioFileId ?? ''),
              transcript: toString(sectionRecord.transcript, fallback.transcript ?? ''),
              playback: {
                limitPlays: toNumber(playback.limitPlays, fallback.playback?.limitPlays ?? 1),
              },
              questions: normalizeQuestions(sectionRecord.questions),
            };
          })
        : (base as IeltsListeningConfig).sections;
      return {
        ...normalizedBase,
        sections: sections.length ? sections : (base as IeltsListeningConfig).sections,
      };
    }
    case 'writing': {
      const task1 =
        record.task1 && typeof record.task1 === 'object' ? (record.task1 as Record<string, unknown>) : {};
      const task2 =
        record.task2 && typeof record.task2 === 'object' ? (record.task2 as Record<string, unknown>) : {};
      return {
        ...normalizedBase,
        task1: {
          prompt: toString(task1.prompt, (base as IeltsWritingConfig).task1.prompt),
          imageFileId:
            task1.imageFileId === null
              ? null
              : toString(task1.imageFileId, (base as IeltsWritingConfig).task1.imageFileId ?? ''),
        },
        task2: {
          prompt: toString(task2.prompt, (base as IeltsWritingConfig).task2.prompt),
        },
      };
    }
    case 'speaking': {
      const part1 =
        record.part1 && typeof record.part1 === 'object' ? (record.part1 as Record<string, unknown>) : {};
      const part2 =
        record.part2 && typeof record.part2 === 'object' ? (record.part2 as Record<string, unknown>) : {};
      const part3 =
        record.part3 && typeof record.part3 === 'object' ? (record.part3 as Record<string, unknown>) : {};
      const cueCard =
        part2.cueCard && typeof part2.cueCard === 'object'
          ? (part2.cueCard as Record<string, unknown>)
          : {};
      return {
        ...normalizedBase,
        part1: {
          questions: Array.isArray(part1.questions)
            ? part1.questions.map((item) => toString(item))
            : (base as IeltsSpeakingConfig).part1.questions,
        },
        part2: {
          cueCard: {
            topic: toString(cueCard.topic, (base as IeltsSpeakingConfig).part2.cueCard.topic),
            bulletPoints: Array.isArray(cueCard.bulletPoints)
              ? cueCard.bulletPoints.map((item) => toString(item))
              : (base as IeltsSpeakingConfig).part2.cueCard.bulletPoints,
          },
          prepSeconds: toNumber(part2.prepSeconds, (base as IeltsSpeakingConfig).part2.prepSeconds),
          talkSeconds: toNumber(part2.talkSeconds, (base as IeltsSpeakingConfig).part2.talkSeconds),
        },
        part3: {
          questions: Array.isArray(part3.questions)
            ? part3.questions.map((item) => toString(item))
            : (base as IeltsSpeakingConfig).part3.questions,
        },
      };
    }
    default:
      return base;
  }
};
