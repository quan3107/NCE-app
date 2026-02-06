/**
 * File: src/prisma/seedIeltsSandbox.ts
 * Purpose: Seed a shared IELTS cross-skill sandbox for teacher/student UI testing.
 * Why: Guarantees one course with 8 official-style IELTS assignments across all 4 skills.
 */
import bcrypt from "bcrypt";

import {
  AssignmentType,
  EnrollmentRole,
  type Prisma,
  UserRole,
  UserStatus,
} from "./generated/client/client.js";
import { basePrisma as prisma } from "./client.js";
import { buildSandboxIeltsAssignmentConfig } from "./seeds/ieltsOfficialFixtures.js";

const SHADOWCLONE_EMAIL = "shadowclone3107@gmail.com";
const DEFAULT_SARAH_EMAIL = "sarah.tutor@ielts.local";
const STUDENT_EMAIL = "amelia.chan@ielts.local";
const DEFAULT_PASSWORD = "Passw0rd!";
const SANDBOX_COURSE_TITLE = "IELTS 4-Skill UIUX Sandbox";

const daysFromNow = (days: number): Date =>
  new Date(Date.now() + days * 24 * 60 * 60 * 1000);

const sandboxAssignments: Array<{
  title: string;
  type: AssignmentType;
  dueInDays: number;
  description: string;
  latePenaltyPercent: number;
  assignmentConfig: Prisma.InputJsonObject;
}> = [
  {
    title: "Reading A1: Multiple Choice + True/False/Not Given",
    type: AssignmentType.reading,
    dueInDays: 4,
    latePenaltyPercent: 10,
    description:
      "IELTS Academic Reading practice with official-style MCQ and T/F/NG items.",
    assignmentConfig: buildSandboxIeltsAssignmentConfig(
      "Reading A1: Multiple Choice + True/False/Not Given",
      AssignmentType.reading,
    ),
  },
  {
    title: "Reading A2: Matching Headings + Sentence Completion",
    type: AssignmentType.reading,
    dueInDays: 6,
    latePenaltyPercent: 10,
    description:
      "IELTS Academic Reading practice focused on heading selection and sentence completion.",
    assignmentConfig: buildSandboxIeltsAssignmentConfig(
      "Reading A2: Matching Headings + Sentence Completion",
      AssignmentType.reading,
    ),
  },
  {
    title: "Listening L1: Sections 1-2 Form Completion",
    type: AssignmentType.listening,
    dueInDays: 5,
    latePenaltyPercent: 5,
    description:
      "IELTS Listening official-style form and note completion in early sections.",
    assignmentConfig: buildSandboxIeltsAssignmentConfig(
      "Listening L1: Sections 1-2 Form Completion",
      AssignmentType.listening,
    ),
  },
  {
    title: "Listening L2: Sections 3-4 MCQ + Short Answer",
    type: AssignmentType.listening,
    dueInDays: 8,
    latePenaltyPercent: 5,
    description:
      "IELTS Listening official-style academic discussion and lecture tasks.",
    assignmentConfig: buildSandboxIeltsAssignmentConfig(
      "Listening L2: Sections 3-4 MCQ + Short Answer",
      AssignmentType.listening,
    ),
  },
  {
    title: "Writing W1: Academic Task 1 + Task 2",
    type: AssignmentType.writing,
    dueInDays: 7,
    latePenaltyPercent: 15,
    description:
      "IELTS Writing Academic simulation with official Task 1 visual summary and Task 2 essay.",
    assignmentConfig: buildSandboxIeltsAssignmentConfig(
      "Writing W1: Academic Task 1 + Task 2",
      AssignmentType.writing,
    ),
  },
  {
    title: "Writing W2: General Training Task 1 + Task 2",
    type: AssignmentType.writing,
    dueInDays: 10,
    latePenaltyPercent: 15,
    description:
      "IELTS General Training simulation with letter writing and opinion essay.",
    assignmentConfig: buildSandboxIeltsAssignmentConfig(
      "Writing W2: General Training Task 1 + Task 2",
      AssignmentType.writing,
    ),
  },
  {
    title: "Speaking S1: Part 1 + Part 2 Cue Card + Part 3",
    type: AssignmentType.speaking,
    dueInDays: 3,
    latePenaltyPercent: 5,
    description:
      "IELTS Speaking full-format interview practice with timed cue-card response.",
    assignmentConfig: buildSandboxIeltsAssignmentConfig(
      "Speaking S1: Part 1 + Part 2 Cue Card + Part 3",
      AssignmentType.speaking,
    ),
  },
  {
    title: "Speaking S2: Fluency and Coherence Drill",
    type: AssignmentType.speaking,
    dueInDays: 9,
    latePenaltyPercent: 5,
    description:
      "IELTS Speaking full-format follow-up set to practice coherence and lexical resource.",
    assignmentConfig: buildSandboxIeltsAssignmentConfig(
      "Speaking S2: Fluency and Coherence Drill",
      AssignmentType.speaking,
    ),
  },
];

async function ensureUser(
  email: string,
  fullName: string,
  role: UserRole,
): Promise<{ id: string; email: string; role: UserRole }> {
  const existing = await prisma.user.findFirst({ where: { email, deletedAt: null } });
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 12);

  if (existing) {
    return prisma.user.update({
      where: { id: existing.id },
      data: { fullName, role, status: UserStatus.active, deletedAt: null, password: passwordHash },
      select: { id: true, email: true, role: true },
    });
  }

  return prisma.user.create({
    data: {
      email,
      fullName,
      role,
      status: UserStatus.active,
      password: passwordHash,
    },
    select: { id: true, email: true, role: true },
  });
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to seed in production mode.");
  }

  const sarahExisting = await prisma.user.findFirst({
    where: {
      deletedAt: null,
      role: UserRole.teacher,
      email: { contains: "sarah", mode: "insensitive" },
    },
    select: { email: true },
    orderBy: { createdAt: "asc" },
  });
  const sarahEmail = sarahExisting?.email ?? DEFAULT_SARAH_EMAIL;

  const shadowclone = await ensureUser(
    SHADOWCLONE_EMAIL,
    "Shadowclone QA Teacher",
    UserRole.teacher,
  );
  const sarah = await ensureUser(sarahEmail, "Sarah Nguyen", UserRole.teacher);
  const student = await ensureUser(STUDENT_EMAIL, "Amelia Chan", UserRole.student);

  let sandboxCourse = await prisma.course.findFirst({
    where: { title: SANDBOX_COURSE_TITLE },
    select: { id: true },
  });

  if (!sandboxCourse) {
    sandboxCourse = await prisma.course.create({
      data: {
        title: SANDBOX_COURSE_TITLE,
        description:
          "Shared IELTS sandbox for cross-skill UI/UX testing across teacher and student roles.",
        ownerId: shadowclone.id,
        scheduleJson: {
          label: "Self-paced with weekly checkpoints",
          timezone: "UTC",
        } as Prisma.InputJsonObject,
      },
      select: { id: true },
    });
  } else {
    await prisma.course.update({
      where: { id: sandboxCourse.id },
      data: { ownerId: shadowclone.id, deletedAt: null },
    });
  }

  const upsertEnrollment = async (userId: string, roleInCourse: EnrollmentRole): Promise<void> => {
    await prisma.enrollment.upsert({
      where: {
        courseId_userId: {
          courseId: sandboxCourse.id,
          userId,
        },
      },
      update: { roleInCourse, deletedAt: null },
      create: {
        courseId: sandboxCourse.id,
        userId,
        roleInCourse,
      },
    });
  };

  await upsertEnrollment(shadowclone.id, EnrollmentRole.teacher);
  await upsertEnrollment(sarah.id, EnrollmentRole.teacher);
  await upsertEnrollment(student.id, EnrollmentRole.student);

  for (const seed of sandboxAssignments) {
    const latePolicy: Prisma.InputJsonObject = {
      type: "percent",
      value: seed.latePenaltyPercent,
    };

    const existing = await prisma.assignment.findFirst({
      where: { courseId: sandboxCourse.id, title: seed.title },
      select: { id: true },
    });

    if (existing) {
      await prisma.assignment.update({
        where: { id: existing.id },
        data: {
          type: seed.type,
          description: seed.description,
          dueAt: daysFromNow(seed.dueInDays),
          publishedAt: daysFromNow(-1),
          latePolicy,
          assignmentConfig: seed.assignmentConfig,
          deletedAt: null,
        },
      });
      continue;
    }

    await prisma.assignment.create({
      data: {
        courseId: sandboxCourse.id,
        title: seed.title,
        type: seed.type,
        description: seed.description,
        dueAt: daysFromNow(seed.dueInDays),
        publishedAt: daysFromNow(-1),
        latePolicy,
        assignmentConfig: seed.assignmentConfig,
      },
    });
  }

  console.info("IELTS sandbox seed complete", {
    courseTitle: SANDBOX_COURSE_TITLE,
    teacherEmails: [shadowclone.email, sarah.email],
    studentEmail: student.email,
    assignmentCount: sandboxAssignments.length,
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error("IELTS sandbox seed failed:", error);
    await prisma.$disconnect();
    process.exit(1);
  });
