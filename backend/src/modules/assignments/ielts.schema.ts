/**
 * File: src/modules/assignments/ielts.schema.ts
 * Purpose: Define IELTS assignment config + submission payload schemas by type/version.
 * Why: Ensures IELTS-specific payloads are validated consistently across create/update flows.
 */
import { AssignmentType } from "../../prisma/generated/client/client.js";
import { z } from "zod";

const IELTS_ASSIGNMENT_TYPES = [
  AssignmentType.reading,
  AssignmentType.listening,
  AssignmentType.writing,
  AssignmentType.speaking,
] as const;

type IeltsAssignmentType = (typeof IELTS_ASSIGNMENT_TYPES)[number];

export const isIeltsAssignmentType = (
  type: AssignmentType,
): type is IeltsAssignmentType =>
  IELTS_ASSIGNMENT_TYPES.includes(type as IeltsAssignmentType);

const configVersionSchema = z.literal(1);

const timingSchema = z
  .object({
    enabled: z.boolean(),
    durationMinutes: z.number().int().min(1),
    enforce: z.boolean(),
    startAt: z.string().optional(),
    endAt: z.string().optional(),
    autoSubmit: z.boolean().optional(),
    rejectLateStart: z.boolean().optional(),
  })
  .strict();

const attemptsSchema = z
  .object({
    maxAttempts: z.number().int().min(1).nullable(),
  })
  .strict();

const baseAssignmentConfigSchema = z
  .object({
    version: configVersionSchema,
    timing: timingSchema.optional(),
    instructions: z.string().optional(),
    attempts: attemptsSchema.optional(),
  })
  .passthrough();

const questionSchema = z.record(z.string(), z.unknown());

const sectionBaseSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    questions: z.array(questionSchema),
  })
  .passthrough();

const readingSectionSchema = sectionBaseSchema.extend({
  passage: z.string().min(1),
});

const listeningSectionSchema = sectionBaseSchema.extend({
  audioFileId: z.string().uuid().nullable(),
  playback: z
    .object({
      limitPlays: z.number().int().min(0),
    })
    .strict()
    .optional(),
});

const readingAssignmentConfigSchema = baseAssignmentConfigSchema.extend({
  sections: z.array(readingSectionSchema),
});

const listeningAssignmentConfigSchema = baseAssignmentConfigSchema.extend({
  sections: z.array(listeningSectionSchema),
});

// Word count validation helper (max 1000 words)
const maxWords = 1000;
const wordCountSchema = z.string()
  .max(50000, "Sample response is too long")
  .refine(
    (text) => {
      if (!text || text.trim() === '') return true;
      const wordCount = text.trim().split(/\s+/).filter(w => w.length > 0).length;
      return wordCount <= maxWords;
    },
    { 
      message: `Sample response must not exceed ${maxWords} words` 
    }
  );

// Visual type enum (teacher-only metadata)
const visualTypeSchema = z.enum([
  'line_graph', 
  'bar_chart', 
  'pie_chart', 
  'table', 
  'diagram', 
  'map', 
  'process'
]).optional();

// Sample visibility timing
const showSampleTimingSchema = z.enum([
  'immediate',
  'after_submission',
  'after_grading',
  'specific_date'
]).optional();

// Task 1 schema with visual type and sample response
const writingTask1Schema = z.object({
  prompt: z.string().min(1, "Task 1 prompt is required"),
  imageFileId: z.string().uuid().nullable().optional(),
  visualType: visualTypeSchema,
  sampleResponse: wordCountSchema.optional(),
  showSampleToStudents: z.boolean().optional(),
  showSampleTiming: showSampleTimingSchema,
  showSampleDate: z.string().datetime().optional(),
  rubricId: z.string().uuid().nullable().optional(),
}).strict().refine(
  (data) => {
    // Can't show sample without content
    if (data.showSampleToStudents && (!data.sampleResponse || data.sampleResponse.trim() === '')) {
      return false;
    }
    // Must have date if timing is specific_date
    if (data.showSampleTiming === 'specific_date' && !data.showSampleDate) {
      return false;
    }
    return true;
  },
  { 
    message: "Invalid sample response configuration",
    path: ["showSampleToStudents"]
  }
);

// Task 2 schema with sample response
const writingTask2Schema = z.object({
  prompt: z.string().min(1, "Task 2 prompt is required"),
  sampleResponse: wordCountSchema.optional(),
  showSampleToStudents: z.boolean().optional(),
  showSampleTiming: showSampleTimingSchema,
  showSampleDate: z.string().datetime().optional(),
  rubricId: z.string().uuid().nullable().optional(),
}).strict().refine(
  (data) => {
    if (data.showSampleToStudents && (!data.sampleResponse || data.sampleResponse.trim() === '')) {
      return false;
    }
    if (data.showSampleTiming === 'specific_date' && !data.showSampleDate) {
      return false;
    }
    return true;
  },
  { 
    message: "Invalid sample response configuration",
    path: ["showSampleToStudents"]
  }
);

const writingAssignmentConfigSchema = baseAssignmentConfigSchema.extend({
  task1: writingTask1Schema,
  task2: writingTask2Schema,
});

const speakingPartSchema = z
  .object({
    questions: z.array(z.string().min(1)),
  })
  .passthrough();

const speakingAssignmentConfigSchema = baseAssignmentConfigSchema.extend({
  part1: speakingPartSchema,
  part2: z
    .object({
      cueCard: z.object({
        topic: z.string().min(1),
        bulletPoints: z.array(z.string().min(1)),
      }),
      prepSeconds: z.number().int().min(0),
      talkSeconds: z.number().int().min(0),
    })
    .passthrough(),
  part3: speakingPartSchema,
});

const assignmentConfigSchemasByType: Record<
  IeltsAssignmentType,
  z.ZodTypeAny
> = {
  [AssignmentType.reading]: readingAssignmentConfigSchema,
  [AssignmentType.listening]: listeningAssignmentConfigSchema,
  [AssignmentType.writing]: writingAssignmentConfigSchema,
  [AssignmentType.speaking]: speakingAssignmentConfigSchema,
};

const submissionBaseSchema = z
  .object({
    version: configVersionSchema.optional().default(1),
    attempt: z.number().int().min(1).optional(),
    startedAt: z.string().optional(),
    submittedAt: z.string().optional(),
    durationSeconds: z.number().int().min(0).optional(),
  })
  .passthrough();

const answerSchema = z
  .object({
    questionId: z.string().min(1),
    value: z.unknown(),
  })
  .passthrough();

const readingSubmissionPayloadSchema = submissionBaseSchema.extend({
  answers: z.array(answerSchema),
});

const listeningSubmissionPayloadSchema = submissionBaseSchema.extend({
  answers: z.array(answerSchema),
});

const writingSubmissionPayloadSchema = submissionBaseSchema.extend({
  task1: z
    .object({
      text: z.string(),
    })
    .passthrough(),
  task2: z
    .object({
      text: z.string(),
    })
    .passthrough(),
});

const speakingSubmissionPayloadSchema = submissionBaseSchema.extend({
  recordings: z.array(
    z
      .object({
        part: z.enum(["part1", "part2", "part3"]),
        fileId: z.string().uuid(),
        durationSeconds: z.number().int().min(1),
      })
      .passthrough(),
  ),
  notes: z.record(z.string(), z.string()).optional(),
});

const submissionPayloadSchemasByType: Record<
  IeltsAssignmentType,
  z.ZodTypeAny
> = {
  [AssignmentType.reading]: readingSubmissionPayloadSchema,
  [AssignmentType.listening]: listeningSubmissionPayloadSchema,
  [AssignmentType.writing]: writingSubmissionPayloadSchema,
  [AssignmentType.speaking]: speakingSubmissionPayloadSchema,
};

export function parseAssignmentConfigForType(
  type: AssignmentType,
  config: unknown,
) {
  if (!isIeltsAssignmentType(type)) {
    return config;
  }
  const schema = assignmentConfigSchemasByType[type];
  const result = z.object({ assignmentConfig: schema }).parse({
    assignmentConfig: config,
  });
  return result.assignmentConfig;
}

export function parseSubmissionPayloadForType(
  type: AssignmentType,
  payload: unknown,
) {
  if (!isIeltsAssignmentType(type)) {
    return payload;
  }
  return submissionPayloadSchemasByType[type].parse(payload);
}
