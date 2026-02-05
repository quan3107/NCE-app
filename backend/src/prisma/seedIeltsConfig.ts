/**
 * File: src/prisma/seedIeltsConfig.ts
 * Purpose: Seed IELTS domain configuration reference data.
 * Why: Ensures /api/v1/config/ielts has baseline data in fresh environments.
 */
import { Prisma } from "./generated/client/client.js";
import { basePrisma } from "./client.js";

const prisma = basePrisma;

const CONFIG_VERSION = 1;

const buildAssignmentTypes = (
  rows: Array<[string, string, string, string, number]>,
): Prisma.IeltsAssignmentTypeCreateManyInput[] =>
  rows.map(([id, label, description, icon, sortOrder]) => ({
    id,
    configVersion: CONFIG_VERSION,
    label,
    description,
    icon,
    enabled: true,
    sortOrder,
  }));

const buildQuestionTypes = (
  skillType: "reading" | "listening",
  rows: Array<[string, string, number]>,
): Prisma.IeltsQuestionTypeCreateManyInput[] =>
  rows.map(([id, label, sortOrder]) => ({
    id,
    configVersion: CONFIG_VERSION,
    skillType,
    label,
    enabled: true,
    sortOrder,
  }));

const buildWritingTaskTypes = (
  taskNumber: 1 | 2,
  rows: Array<[string, string, number]>,
): Prisma.IeltsWritingTaskTypeCreateManyInput[] =>
  rows.map(([id, label, sortOrder]) => ({
    id,
    configVersion: CONFIG_VERSION,
    taskNumber,
    label,
    enabled: true,
    sortOrder,
  }));

const buildSpeakingPartTypes = (
  rows: Array<[string, string, number]>,
): Prisma.IeltsSpeakingPartTypeCreateManyInput[] =>
  rows.map(([id, label, sortOrder]) => ({
    id,
    configVersion: CONFIG_VERSION,
    label,
    enabled: true,
    sortOrder,
  }));

const buildCompletionFormats = (
  rows: Array<[string, string, number]>,
): Prisma.IeltsCompletionFormatCreateManyInput[] =>
  rows.map(([id, label, sortOrder]) => ({
    id,
    configVersion: CONFIG_VERSION,
    label,
    enabled: true,
    sortOrder,
  }));

const buildSampleTimingOptions = (
  rows: Array<[string, string, string, number]>,
): Prisma.IeltsSampleTimingOptionCreateManyInput[] =>
  rows.map(([id, label, description, sortOrder]) => ({
    id,
    configVersion: CONFIG_VERSION,
    label,
    description,
    enabled: true,
    sortOrder,
  }));

const assignmentTypes = buildAssignmentTypes([
  ["reading", "Reading", "Reading comprehension test", "book-open", 1],
  [
    "listening",
    "Listening",
    "Listening comprehension test",
    "headphones",
    2,
  ],
  [
    "writing",
    "Writing",
    "Writing test with Task 1 and Task 2",
    "pen-tool",
    3,
  ],
  ["speaking", "Speaking", "Speaking test with three parts", "mic", 4],
]);

const readingQuestionTypes = buildQuestionTypes("reading", [
  ["multiple_choice", "Multiple Choice", 1],
  ["true_false_not_given", "True/False/Not Given", 2],
  ["yes_no_not_given", "Yes/No/Not Given", 3],
  ["matching_headings", "Matching Headings", 4],
  ["matching_information", "Matching Information", 5],
  ["matching_features", "Matching Features", 6],
  ["sentence_completion", "Sentence Completion", 7],
  ["completion", "Completion (Form/Note/Table/etc.)", 8],
  ["diagram_labeling", "Diagram Labeling", 9],
  ["short_answer", "Short Answer", 10],
]);

const listeningQuestionTypes = buildQuestionTypes("listening", [
  ["multiple_choice", "Multiple Choice", 1],
  ["matching", "Matching", 2],
  ["map_diagram_labeling", "Map/Diagram Labeling", 3],
  ["completion", "Completion (Form/Note/Table/etc.)", 4],
  ["sentence_completion", "Sentence Completion", 5],
  ["short_answer", "Short Answer", 6],
]);

const writingTask1Types = buildWritingTaskTypes(1, [
  ["line_graph", "Line Graph", 1],
  ["bar_chart", "Bar Chart", 2],
  ["pie_chart", "Pie Chart", 3],
  ["table", "Table", 4],
  ["diagram", "Diagram", 5],
  ["map", "Map", 6],
  ["process", "Process", 7],
]);

const writingTask2Types = buildWritingTaskTypes(2, [
  ["opinion", "Opinion Essay", 1],
  ["discussion", "Discussion Essay", 2],
  ["problem_solution", "Problem-Solution Essay", 3],
  ["advantages_disadvantages", "Advantages & Disadvantages Essay", 4],
  ["double_question", "Double Question Essay", 5],
]);

const speakingPartTypes = buildSpeakingPartTypes([
  ["part1_personal", "Part 1: Personal Questions", 1],
  ["part2_cue_card", "Part 2: Cue Card", 2],
  ["part3_discussion", "Part 3: Discussion", 3],
]);

const completionFormats = buildCompletionFormats([
  ["form", "Form Completion", 1],
  ["note", "Note Completion", 2],
  ["table", "Table Completion", 3],
  ["flow_chart", "Flow Chart Completion", 4],
  ["summary", "Summary Completion", 5],
]);

const sampleTimingOptions = buildSampleTimingOptions([
  ["immediate", "Immediately", "Show sample response immediately", 1],
  [
    "after_submission",
    "After student submits",
    "Show after student submits their work",
    2,
  ],
  [
    "after_grading",
    "After grading is complete",
    "Show after teacher grades the submission",
    3,
  ],
  [
    "specific_date",
    "On a specific date",
    "Show on a specific date and time",
    4,
  ],
]);

async function ensureConfigVersion(): Promise<void> {
  const active = await prisma.ieltsConfigVersion.findFirst({
    where: { isActive: true },
  });
  const existing = await prisma.ieltsConfigVersion.findUnique({
    where: { version: CONFIG_VERSION },
  });

  if (!existing) {
    await prisma.ieltsConfigVersion.create({
      data: {
        version: CONFIG_VERSION,
        name: "Initial",
        description: "First IELTS configuration version",
        isActive: true,
        activatedAt: new Date(),
      },
    });
    return;
  }

  if (!active && !existing.isActive) {
    await prisma.ieltsConfigVersion.update({
      where: { version: CONFIG_VERSION },
      data: {
        isActive: true,
        activatedAt: new Date(),
      },
    });
  }
}

async function seedConfigTables(): Promise<void> {
  // Use skipDuplicates to keep seeds idempotent without overwriting live config.
  await prisma.$transaction([
    prisma.ieltsAssignmentType.createMany({
      data: assignmentTypes,
      skipDuplicates: true,
    }),
    prisma.ieltsQuestionType.createMany({
      data: [...readingQuestionTypes, ...listeningQuestionTypes],
      skipDuplicates: true,
    }),
    prisma.ieltsWritingTaskType.createMany({
      data: [...writingTask1Types, ...writingTask2Types],
      skipDuplicates: true,
    }),
    prisma.ieltsSpeakingPartType.createMany({
      data: speakingPartTypes,
      skipDuplicates: true,
    }),
    prisma.ieltsCompletionFormat.createMany({
      data: completionFormats,
      skipDuplicates: true,
    }),
    prisma.ieltsSampleTimingOption.createMany({
      data: sampleTimingOptions,
      skipDuplicates: true,
    }),
  ]);
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to seed in production mode.");
  }

  console.info("Seeding IELTS configuration...");
  await ensureConfigVersion();
  await seedConfigTables();
  console.info("IELTS configuration seed complete.");
}

main()
  .catch((error) => {
    console.error("IELTS config seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
