/**
 * File: src/prisma/seedIeltsAssignments.ts
 * Purpose: Seed IELTS assignments without wiping existing data.
 * Why: Allows adding/updating IELTS assignment configs while preserving other records.
 */
import { AssignmentType, Prisma } from './generated.js';
import { basePrisma } from './client.js';
import { buildPrimaryIeltsAssignmentConfig } from './seeds/ieltsOfficialFixtures.js';

const prisma = basePrisma;

const daysFromNow = (days: number): Date =>
  new Date(Date.now() + days * 24 * 60 * 60 * 1000);

const assignmentSeeds: Array<{
  courseTitle: string;
  title: string;
  description: string;
  type: AssignmentType;
  dueInDays: number;
  latePenaltyPercent: number;
  assignmentConfig: Prisma.InputJsonObject;
}> = [
  {
    courseTitle: 'IELTS Academic Writing Bootcamp',
    title: 'Academic Essay: Technology and Society',
    description:
      'Write a 250-word Task 2 response discussing whether increasing reliance on technology benefits society.',
    type: AssignmentType.writing,
    dueInDays: 5,
    latePenaltyPercent: 10,
    assignmentConfig: buildPrimaryIeltsAssignmentConfig(
      'Academic Essay: Technology and Society',
      AssignmentType.writing,
    ),
  },
  {
    courseTitle: 'IELTS Academic Writing Bootcamp',
    title: 'Data Interpretation Task 1: Global Energy Mix',
    description:
      'Summarize the main trends from the provided chart comparing global energy sources between 1990 and 2030.',
    type: AssignmentType.writing,
    dueInDays: 10,
    latePenaltyPercent: 15,
    assignmentConfig: buildPrimaryIeltsAssignmentConfig(
      'Data Interpretation Task 1: Global Energy Mix',
      AssignmentType.writing,
    ),
  },
  {
    courseTitle: 'IELTS Speaking Masterclass',
    title: 'Part 2 Cue Card: Memorable Journey',
    description:
      'Record a two-minute response to the cue card about a memorable journey, focusing on coherence and fluency.',
    type: AssignmentType.speaking,
    dueInDays: 3,
    latePenaltyPercent: 5,
    assignmentConfig: buildPrimaryIeltsAssignmentConfig(
      'Part 2 Cue Card: Memorable Journey',
      AssignmentType.speaking,
    ),
  },
  {
    courseTitle: 'IELTS Speaking Masterclass',
    title: 'Part 3 Discussion: Urban Living',
    description:
      'Submit a recorded discussion on the pros and cons of living in a large city versus a small town.',
    type: AssignmentType.speaking,
    dueInDays: 8,
    latePenaltyPercent: 10,
    assignmentConfig: buildPrimaryIeltsAssignmentConfig(
      'Part 3 Discussion: Urban Living',
      AssignmentType.speaking,
    ),
  },
  {
    courseTitle: 'IELTS Listening Lab',
    title: 'Section 3 University Projects',
    description:
      'Complete the listening comprehension questions for the Section 3 recording and upload your answer sheet.',
    type: AssignmentType.listening,
    dueInDays: 4,
    latePenaltyPercent: 10,
    assignmentConfig: buildPrimaryIeltsAssignmentConfig(
      'Section 3 University Projects',
      AssignmentType.listening,
    ),
  },
  {
    courseTitle: 'IELTS Listening Lab',
    title: 'Gap Fill Drill: Renewable Energy Lecture',
    description:
      'Fill in the missing words from the lecture transcript to practice predictive listening strategies.',
    type: AssignmentType.listening,
    dueInDays: 9,
    latePenaltyPercent: 5,
    assignmentConfig: buildPrimaryIeltsAssignmentConfig(
      'Gap Fill Drill: Renewable Energy Lecture',
      AssignmentType.listening,
    ),
  },
  {
    courseTitle: 'IELTS Reading Strategies Workshop',
    title: 'True/False/Not Given Drill',
    description:
      'Answer T/F/NG questions from a sample Academic passage focusing on inference and paraphrasing.',
    type: AssignmentType.reading,
    dueInDays: 6,
    latePenaltyPercent: 5,
    assignmentConfig: buildPrimaryIeltsAssignmentConfig(
      'True/False/Not Given Drill',
      AssignmentType.reading,
    ),
  },
  {
    courseTitle: 'IELTS Reading Strategies Workshop',
    title: 'Matching Headings Practice',
    description:
      'Match paragraph headings with the provided reading passage and justify each decision.',
    type: AssignmentType.reading,
    dueInDays: 11,
    latePenaltyPercent: 10,
    assignmentConfig: buildPrimaryIeltsAssignmentConfig(
      'Matching Headings Practice',
      AssignmentType.reading,
    ),
  },
  {
    courseTitle: 'IELTS General Training Fast Track',
    title: 'General Training Letter: Workplace Equipment',
    description:
      'Write a Task 1 letter to your manager requesting new equipment and explaining the benefits.',
    type: AssignmentType.writing,
    dueInDays: 7,
    latePenaltyPercent: 5,
    assignmentConfig: buildPrimaryIeltsAssignmentConfig(
      'General Training Letter: Workplace Equipment',
      AssignmentType.writing,
    ),
  },
  {
    courseTitle: 'IELTS General Training Fast Track',
    title: 'Listening Mock Test: Band 7 Target',
    description:
      'Complete the listening mock test, aiming for band 7 accuracy, and upload the answer sheet.',
    type: AssignmentType.listening,
    dueInDays: 12,
    latePenaltyPercent: 10,
    assignmentConfig: buildPrimaryIeltsAssignmentConfig(
      'Listening Mock Test: Band 7 Target',
      AssignmentType.listening,
    ),
  },
];

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed in production mode.');
  }

  const courseTitles = Array.from(
    new Set(assignmentSeeds.map((seed) => seed.courseTitle)),
  );
  const courses = await prisma.course.findMany({
    where: { title: { in: courseTitles }, deletedAt: null },
  });
  const courseByTitle = new Map(courses.map((course) => [course.title, course]));

  let created = 0;
  let updated = 0;

  for (const seed of assignmentSeeds) {
    const course = courseByTitle.get(seed.courseTitle);
    if (!course) {
      throw new Error(`Missing course for assignment ${seed.title}`);
    }

    const existing = await prisma.assignment.findFirst({
      where: { courseId: course.id, title: seed.title, deletedAt: null },
    });

    if (existing) {
      // Avoid overwriting real due dates or policies outside IELTS config.
      await prisma.assignment.update({
        where: { id: existing.id },
        data: { type: seed.type, assignmentConfig: seed.assignmentConfig },
      });
      updated += 1;
      continue;
    }

    const latePolicy: Prisma.InputJsonObject = {
      type: 'percent',
      value: seed.latePenaltyPercent,
    };
    await prisma.assignment.create({
      data: {
        courseId: course.id,
        title: seed.title,
        description: seed.description,
        type: seed.type,
        dueAt: daysFromNow(seed.dueInDays),
        latePolicy,
        assignmentConfig: seed.assignmentConfig,
        publishedAt: daysFromNow(-1),
      },
    });
    created += 1;
  }

  console.info(
    `IELTS assignments seed complete (created=${created}, updated=${updated}).`,
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error('IELTS assignment seed failed:', error);
    await prisma.$disconnect();
    process.exit(1);
  });
