/**
 * File: src/prisma/seed.ts
 * Purpose: Seed the PostgreSQL database with representative fixtures for local development.
 * Why: Provides a TypeScript-based script that exercises core relations after migrating to Prisma.
 */
import bcrypt from "bcrypt";
import { createHash, randomBytes } from "node:crypto";
import {
  AssignmentType,
  EnrollmentRole,
  IdentityProvider,
  NotificationChannel,
  NotificationStatus,
  Prisma,
  Submission,
  SubmissionStatus,
  UserRole,
  UserStatus,
} from './generated.js';
import { basePrisma } from './client.js';
import { buildPrimaryIeltsAssignmentConfig } from './seeds/ieltsOfficialFixtures.js';

const prisma = basePrisma;

const daysFromNow = (days: number): Date =>
  new Date(Date.now() + days * 24 * 60 * 60 * 1000);

async function resetData(): Promise<void> {
  await prisma.$transaction([
    prisma.auditLog.deleteMany(),
    prisma.identity.deleteMany(),
    prisma.authSession.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.grade.deleteMany(),
    prisma.submission.deleteMany(),
    prisma.assignment.deleteMany(),
    prisma.rubric.deleteMany(),
    prisma.enrollment.deleteMany(),
    prisma.file.deleteMany(),
    prisma.course.deleteMany(),
    prisma.user.deleteMany(),
  ]);
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to seed in production mode.");
  }

  console.info("Resetting existing data...");
  await resetData();

  console.info("Creating IELTS-focused users...");
  const passwordHash = await bcrypt.hash("Passw0rd!", 12);

  const userFixtures: Array<Prisma.UserCreateInput> = [
    {
      id: "11111111-1111-4111-8111-111111111111",
      email: "rosa.admin@ielts.local",
      password: passwordHash,
      fullName: "Rosa Martinez",
      role: UserRole.admin,
      status: UserStatus.active,
    },
    {
      id: "22222222-2222-4222-8222-222222222222",
      email: "sarah.tutor@ielts.local",
      password: passwordHash,
      fullName: "Sarah Nguyen",
      role: UserRole.teacher,
      status: UserStatus.active,
    },
    {
      id: "44444444-4444-4444-8444-444444444444",
      email: "david.tutor@ielts.local",
      password: passwordHash,
      fullName: "David Walker",
      role: UserRole.teacher,
      status: UserStatus.active,
    },
    {
      id: "33333333-3333-4333-8333-333333333333",
      email: "amelia.chan@ielts.local",
      password: passwordHash,
      fullName: "Amelia Chan",
      role: UserRole.student,
      status: UserStatus.active,
    },
    {
      id: "55555555-5555-4555-8555-555555555555",
      email: "noah.patel@ielts.local",
      password: passwordHash,
      fullName: "Noah Patel",
      role: UserRole.student,
      status: UserStatus.active,
    },
    {
      id: "66666666-6666-4666-8666-666666666666",
      email: "li.huang@ielts.local",
      password: passwordHash,
      fullName: "Li Huang",
      role: UserRole.student,
      status: UserStatus.active,
    },
    {
      id: "77777777-7777-4777-8777-777777777777",
      email: "fatima.ahmed@ielts.local",
      password: passwordHash,
      fullName: "Fatima Ahmed",
      role: UserRole.student,
      status: UserStatus.invited,
    },
    {
      id: "88888888-8888-4888-8888-888888888888",
      email: "diego.rojas@ielts.local",
      password: passwordHash,
      fullName: "Diego Rojas",
      role: UserRole.student,
      status: UserStatus.active,
    },
    {
      id: "99999999-9999-4999-8999-999999999999",
      email: "sofia.mendes@ielts.local",
      password: passwordHash,
      fullName: "Sofia Mendes",
      role: UserRole.student,
      status: UserStatus.active,
    },
  ];

  const users = await Promise.all(
    userFixtures.map((data) => prisma.user.create({ data }))
  );
  const userByEmail = new Map(users.map((user) => [user.email, user]));

  console.info("Creating IELTS courses and enrollments...");
  const courseSeeds: Array<{
    title: string;
    description: string;
    // Prisma JSON columns expect readonly arrays; we normalize them here.
    learningOutcomes: Prisma.InputJsonArray;
    structureSummary: string;
    prerequisitesSummary: string;
    ownerEmail: string;
    cadence: string;
    startTime: string;
    durationMinutes: number;
    scheduleLabel: string;
    durationLabel: string;
    level: string;
    price: number;
    studentEmails: string[];
  }> = [
    {
      title: "IELTS Academic Writing Bootcamp",
      description:
        "Four-week intensive on Task 1 and Task 2 academic writing responses.",
      learningOutcomes: [
        "Craft data-driven Task 1 essays using examiner-approved structure.",
        "Develop coherent arguments with advanced cohesive devices for Task 2.",
        "Expand academic vocabulary and tone tailored to band 7+ expectations.",
      ] as Prisma.InputJsonArray,
      structureSummary:
        "Weekly live workshops paired with asynchronous drafting clinics and annotated feedback loops.",
      prerequisitesSummary:
        "Ideal for candidates already scoring Band 6 in writing; submit a recent essay sample during onboarding.",
      ownerEmail: "sarah.tutor@ielts.local",
      cadence: "Mon-Wed",
      startTime: "18:30",
      durationMinutes: 120,
      scheduleLabel: "Mon/Wed 6:30-8:30 PM ET",
      durationLabel: "4 weeks",
      level: "Advanced",
      price: 299,
      studentEmails: [
        "amelia.chan@ielts.local",
        "noah.patel@ielts.local",
        "li.huang@ielts.local",
      ],
    },
    {
      title: "IELTS Speaking Masterclass",
      description:
        "Small-group speaking drills with emphasis on fluency, coherence, and pronunciation.",
      learningOutcomes: [
        "Build spontaneity and depth for Part 3 follow-up questions.",
        "Strengthen pronunciation through targeted phoneme and stress drills.",
        "Refine band-scaling vocabulary and idiomatic range for Part 2 stories.",
      ] as Prisma.InputJsonArray,
      structureSummary:
        "Twice-weekly studio sessions featuring timed mock interviews and individualized speech analysis clips.",
      prerequisitesSummary:
        "Comfortable with conversational English; complete a recorded placement interview before the first class.",
      ownerEmail: "david.tutor@ielts.local",
      cadence: "Tue-Thu",
      startTime: "07:30",
      durationMinutes: 90,
      scheduleLabel: "Tue/Thu 7:30-9:00 AM ET",
      durationLabel: "6 weeks",
      level: "Intermediate",
      price: 249,
      studentEmails: [
        "fatima.ahmed@ielts.local",
        "diego.rojas@ielts.local",
        "sofia.mendes@ielts.local",
      ],
    },
    {
      title: "IELTS Listening Lab",
      description:
        "Targeted listening comprehension sessions using authentic recordings and transcripts.",
      learningOutcomes: [
        "Decode fast native accents across academic and conversational contexts.",
        "Practice predictive listening using signposting language and question stems.",
        "Build stamina for multi-step matching and map-completion tasks.",
      ] as Prisma.InputJsonArray,
      structureSummary:
        "Saturday intensives combine exam-style drills, transcript breakdowns, and reflection journals.",
      prerequisitesSummary:
        "Bring wired headphones and commit to weekly shadowing homework; no band minimum required.",
      ownerEmail: "sarah.tutor@ielts.local",
      cadence: "Sat",
      startTime: "10:00",
      durationMinutes: 150,
      scheduleLabel: "Saturday 10:00 AM-12:30 PM ET",
      durationLabel: "8 weeks",
      level: "All Levels",
      price: 189,
      studentEmails: [
        "noah.patel@ielts.local",
        "fatima.ahmed@ielts.local",
        "li.huang@ielts.local",
      ],
    },
    {
      title: "IELTS Reading Strategies Workshop",
      description:
        "Skimming, scanning, and inference drills for Academic and General Training reading passages.",
      learningOutcomes: [
        "Crack headline matching and paragraph classification with replicable heuristics.",
        "Apply timing checkpoints to finish all sections without sacrificing accuracy.",
        "Strengthen inference skills for True/False/Not Given traps.",
      ] as Prisma.InputJsonArray,
      structureSummary:
        "Each session opens with a timing lab, followed by strategy debriefs and mini group competitions.",
      prerequisitesSummary:
        "Students should be comfortable reading upper-intermediate texts; diagnostic reading quiz provided at signup.",
      ownerEmail: "david.tutor@ielts.local",
      cadence: "Fri",
      startTime: "17:00",
      durationMinutes: 120,
      scheduleLabel: "Friday 5:00-7:00 PM ET",
      durationLabel: "5 weeks",
      level: "Upper-Intermediate",
      price: 219,
      studentEmails: [
        "amelia.chan@ielts.local",
        "sofia.mendes@ielts.local",
        "diego.rojas@ielts.local",
      ],
    },
    {
      title: "IELTS General Training Fast Track",
      description:
        "Comprehensive review for candidates targeting band 7 within six weeks.",
      learningOutcomes: [
        "Map out a personalized study calendar anchored to official scoring rubrics.",
        "Master letter-writing formats and tone required for the General Training exam.",
        "Integrate listening, reading, and speaking drills to reinforce daily progress.",
      ] as Prisma.InputJsonArray,
      structureSummary:
        "Sunday bootcamps featuring rotating skill stations, homework reviews, and peer accountability huddles.",
      prerequisitesSummary:
        "Designed for working professionals; expect 6 hours of independent practice per week alongside live sessions.",
      ownerEmail: "sarah.tutor@ielts.local",
      cadence: "Sun",
      startTime: "08:30",
      durationMinutes: 180,
      scheduleLabel: "Sunday 8:30-11:30 AM ET",
      durationLabel: "6 weeks",
      level: "Upper-Intermediate",
      price: 329,
      studentEmails: [
        "li.huang@ielts.local",
        "fatima.ahmed@ielts.local",
        "diego.rojas@ielts.local",
      ],
    },
  ];

  const createdCourses = [];
  const enrollmentBatches: Prisma.EnrollmentCreateManyInput[] = [];

  for (const seed of courseSeeds) {
    const owner = userByEmail.get(seed.ownerEmail);
    if (!owner) {
      throw new Error(`Missing owner user for ${seed.title}`);
    }

    const scheduleJson: Prisma.InputJsonObject = {
      cadence: seed.cadence,
      start_time: seed.startTime,
      duration_minutes: seed.durationMinutes,
      time_zone: "America/New_York",
      format: "live-online",
      label: seed.scheduleLabel,
      duration: seed.durationLabel,
      level: seed.level,
      price: seed.price,
    };

    const courseData: Prisma.CourseUncheckedCreateInput = {
      title: seed.title,
      description: seed.description,
      // Cast to Prisma's generic JSON input union so TS goal state matches the schema.
      learningOutcomes: seed.learningOutcomes as Prisma.InputJsonValue,
      structureSummary: seed.structureSummary,
      prerequisitesSummary: seed.prerequisitesSummary,
      scheduleJson,
      ownerId: owner.id,
    };

    const course = await prisma.course.create({
      data: courseData,
    });

    createdCourses.push(course);

    enrollmentBatches.push({
      courseId: course.id,
      userId: owner.id,
      roleInCourse: EnrollmentRole.teacher,
    });

    for (const studentEmail of seed.studentEmails) {
      const student = userByEmail.get(studentEmail);
      if (!student) {
        throw new Error(`Missing student user for ${seed.title}`);
      }

      enrollmentBatches.push({
        courseId: course.id,
        userId: student.id,
        roleInCourse: EnrollmentRole.student,
      });
    }
  }

  await prisma.enrollment.createMany({ data: enrollmentBatches });

  const courseByTitle = new Map(
    createdCourses.map((course) => [course.title, course])
  );

  console.info("Creating IELTS rubrics...");
  const rubricSeeds = courseSeeds.map((seed) => ({
    courseTitle: seed.title,
    name: `${seed.title} Rubric`,
    criteria: [
      {
        criterion: "Task Achievement",
        weight: 0.25,
        bands: [
          {
            band: 9,
            descriptor: "Fully satisfies the task with insightful development.",
          },
          {
            band: 7,
            descriptor: "Addresses all parts with some unevenness.",
          },
          {
            band: 5,
            descriptor: "Partial coverage with gaps in key elements.",
          },
        ],
      },
      {
        criterion: "Coherence & Cohesion",
        weight: 0.25,
        bands: [
          {
            band: 9,
            descriptor: "Logical progression with seamless linking phrases.",
          },
          {
            band: 7,
            descriptor: "Generally coherent with minor lapses.",
          },
          {
            band: 5,
            descriptor: "Inconsistent organization and referencing.",
          },
        ],
      },
      {
        criterion: "Lexical Resource",
        weight: 0.25,
        bands: [
          { band: 9, descriptor: "Wide vocabulary with natural control." },
          {
            band: 7,
            descriptor: "Appropriate range though occasional inaccuracies.",
          },
          {
            band: 5,
            descriptor: "Limited range and noticeable repetition.",
          },
        ],
      },
      {
        criterion: "Grammatical Range & Accuracy",
        weight: 0.25,
        bands: [
          { band: 9, descriptor: "Error-free with complex structures." },
          { band: 7, descriptor: "Good control with some errors." },
          { band: 5, descriptor: "Frequent errors limit clarity." },
        ],
      },
    ] as Prisma.InputJsonArray,
  }));

  const rubrics = await Promise.all(
    rubricSeeds.map((seed) => {
      const course = courseByTitle.get(seed.courseTitle);
      if (!course) {
        throw new Error(`Missing course for rubric ${seed.name}`);
      }
      return prisma.rubric.create({
        data: {
          courseId: course.id,
          name: seed.name,
          criteria: seed.criteria,
        },
      });
    })
  );

  console.info("Creating rubric templates...");
  await prisma.rubricTemplate.createMany({
    data: [
      {
        name: "Course Default Rubric",
        context: "course",
        assignmentType: "generic",
        sortOrder: 1,
        criteria: [
          {
            id: "task-achievement",
            name: "Task Achievement",
            weight: 25,
            description: "How well the task requirements are met",
          },
          {
            id: "coherence-cohesion",
            name: "Coherence & Cohesion",
            weight: 25,
            description: "Logical organization and flow",
          },
          {
            id: "lexical-resource",
            name: "Lexical Resource",
            weight: 25,
            description: "Vocabulary range and accuracy",
          },
          {
            id: "grammatical-range",
            name: "Grammatical Range",
            weight: 25,
            description: "Grammar variety and accuracy",
          },
        ] as Prisma.InputJsonArray,
      },
      {
        name: "Writing Assignment Rubric",
        context: "assignment",
        assignmentType: "writing",
        sortOrder: 1,
        criteria: [
          {
            id: "overall-performance",
            name: "Overall Performance",
            weight: 100,
            levels: [
              {
                label: "Meets expectations",
                points: 100,
                desc: "Meets the rubric requirements.",
              },
            ],
          },
        ] as Prisma.InputJsonArray,
      },
      {
        name: "Writing Grading Rubric",
        context: "grading",
        assignmentType: "writing",
        sortOrder: 1,
        criteria: [
          {
            id: "format-structure",
            name: "Format & Structure",
            weight: 20,
            maxScore: 10,
            description: "Organization, formatting, and structural quality.",
          },
          {
            id: "content-analysis",
            name: "Content & Analysis",
            weight: 40,
            maxScore: 20,
            description: "Depth of response, argumentation, and analysis.",
          },
          {
            id: "clarity-professionalism",
            name: "Clarity & Professionalism",
            weight: 20,
            maxScore: 10,
            description: "Clarity, tone, and communication quality.",
          },
          {
            id: "grammar-mechanics",
            name: "Grammar & Mechanics",
            weight: 20,
            maxScore: 10,
            description: "Accuracy of grammar, spelling, and punctuation.",
          },
        ] as Prisma.InputJsonArray,
      },
    ],
    skipDuplicates: true,
  });

  console.info("Creating IELTS assignments...");
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
      courseTitle: "IELTS Academic Writing Bootcamp",
      title: "Academic Essay: Technology and Society",
      description:
        "Write a 250-word Task 2 response discussing whether increasing reliance on technology benefits society.",
      type: AssignmentType.writing,
      dueInDays: 5,
      latePenaltyPercent: 10,
      assignmentConfig: buildPrimaryIeltsAssignmentConfig(
        "Academic Essay: Technology and Society",
        AssignmentType.writing,
      ),
    },
    {
      courseTitle: "IELTS Academic Writing Bootcamp",
      title: "Data Interpretation Task 1: Global Energy Mix",
      description:
        "Summarize the main trends from the provided chart comparing global energy sources between 1990 and 2030.",
      type: AssignmentType.writing,
      dueInDays: 10,
      latePenaltyPercent: 15,
      assignmentConfig: buildPrimaryIeltsAssignmentConfig(
        "Data Interpretation Task 1: Global Energy Mix",
        AssignmentType.writing,
      ),
    },
    {
      courseTitle: "IELTS Speaking Masterclass",
      title: "Part 2 Cue Card: Memorable Journey",
      description:
        "Record a two-minute response to the cue card about a memorable journey, focusing on coherence and fluency.",
      type: AssignmentType.speaking,
      dueInDays: 3,
      latePenaltyPercent: 5,
      assignmentConfig: buildPrimaryIeltsAssignmentConfig(
        "Part 2 Cue Card: Memorable Journey",
        AssignmentType.speaking,
      ),
    },
    {
      courseTitle: "IELTS Speaking Masterclass",
      title: "Part 3 Discussion: Urban Living",
      description:
        "Submit a recorded discussion on the pros and cons of living in a large city versus a small town.",
      type: AssignmentType.speaking,
      dueInDays: 8,
      latePenaltyPercent: 10,
      assignmentConfig: buildPrimaryIeltsAssignmentConfig(
        "Part 3 Discussion: Urban Living",
        AssignmentType.speaking,
      ),
    },
    {
      courseTitle: "IELTS Listening Lab",
      title: "Section 3 University Projects",
      description:
        "Complete the listening comprehension questions for the Section 3 recording and upload your answer sheet.",
      type: AssignmentType.listening,
      dueInDays: 4,
      latePenaltyPercent: 10,
      assignmentConfig: buildPrimaryIeltsAssignmentConfig(
        "Section 3 University Projects",
        AssignmentType.listening,
      ),
    },
    {
      courseTitle: "IELTS Listening Lab",
      title: "Gap Fill Drill: Renewable Energy Lecture",
      description:
        "Fill in the missing words from the lecture transcript to practice predictive listening strategies.",
      type: AssignmentType.listening,
      dueInDays: 9,
      latePenaltyPercent: 5,
      assignmentConfig: buildPrimaryIeltsAssignmentConfig(
        "Gap Fill Drill: Renewable Energy Lecture",
        AssignmentType.listening,
      ),
    },
    {
      courseTitle: "IELTS Reading Strategies Workshop",
      title: "True/False/Not Given Drill",
      description:
        "Answer T/F/NG questions from a sample Academic passage focusing on inference and paraphrasing.",
      type: AssignmentType.reading,
      dueInDays: 6,
      latePenaltyPercent: 5,
      assignmentConfig: buildPrimaryIeltsAssignmentConfig(
        "True/False/Not Given Drill",
        AssignmentType.reading,
      ),
    },
    {
      courseTitle: "IELTS Reading Strategies Workshop",
      title: "Matching Headings Practice",
      description:
        "Match paragraph headings with the provided reading passage and justify each decision.",
      type: AssignmentType.reading,
      dueInDays: 11,
      latePenaltyPercent: 10,
      assignmentConfig: buildPrimaryIeltsAssignmentConfig(
        "Matching Headings Practice",
        AssignmentType.reading,
      ),
    },
    {
      courseTitle: "IELTS General Training Fast Track",
      title: "General Training Letter: Workplace Equipment",
      description:
        "Write a Task 1 letter to your manager requesting new equipment and explaining the benefits.",
      type: AssignmentType.writing,
      dueInDays: 7,
      latePenaltyPercent: 5,
      assignmentConfig: buildPrimaryIeltsAssignmentConfig(
        "General Training Letter: Workplace Equipment",
        AssignmentType.writing,
      ),
    },
    {
      courseTitle: "IELTS General Training Fast Track",
      title: "Listening Mock Test: Band 7 Target",
      description:
        "Complete the listening mock test, aiming for band 7 accuracy, and upload the answer sheet.",
      type: AssignmentType.listening,
      dueInDays: 12,
      latePenaltyPercent: 10,
      assignmentConfig: buildPrimaryIeltsAssignmentConfig(
        "Listening Mock Test: Band 7 Target",
        AssignmentType.listening,
      ),
    },
  ];

  const assignments = await Promise.all(
    assignmentSeeds.map((seed) => {
      const course = courseByTitle.get(seed.courseTitle);
      if (!course) {
        throw new Error(`Missing course for assignment ${seed.title}`);
      }
      const latePolicy: Prisma.InputJsonObject = {
        type: "percent",
        value: seed.latePenaltyPercent,
      };
      return prisma.assignment.create({
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
    })
  );

  const assignmentByTitle = new Map(
    assignments.map((assignment) => [assignment.title, assignment])
  );

  console.info("Creating IELTS submissions and grades...");
  const submissionSeeds: Array<{
    assignmentTitle: string;
    studentEmail: string;
    status: SubmissionStatus;
    submittedOffsetDays: number;
    graderEmail: string;
    rawScore: number;
    finalScore: number;
    feedback: string;
    adjustments?: Prisma.InputJsonArray;
  }> = [
    {
      assignmentTitle: "Academic Essay: Technology and Society",
      studentEmail: "amelia.chan@ielts.local",
      status: SubmissionStatus.submitted,
      submittedOffsetDays: -1,
      graderEmail: "sarah.tutor@ielts.local",
      rawScore: 7.5,
      finalScore: 7.5,
      feedback:
        "Excellent progression and precise vocabulary. Consider more varied complex clauses to push Band 8.",
    },
    {
      assignmentTitle: "Data Interpretation Task 1: Global Energy Mix",
      studentEmail: "noah.patel@ielts.local",
      status: SubmissionStatus.late,
      submittedOffsetDays: 11,
      graderEmail: "sarah.tutor@ielts.local",
      rawScore: 7.0,
      finalScore: 6.5,
      feedback:
        "Clear overview and key comparisons. Minor inaccuracies and late submission reduced the final score.",
      adjustments: [{ reason: "late_submission", delta: -0.5 }] as Prisma.InputJsonArray,
    },
    {
      assignmentTitle: "Part 2 Cue Card: Memorable Journey",
      studentEmail: "fatima.ahmed@ielts.local",
      status: SubmissionStatus.submitted,
      submittedOffsetDays: -2,
      graderEmail: "david.tutor@ielts.local",
      rawScore: 7.0,
      finalScore: 7.0,
      feedback:
        "Smooth delivery and cohesive story. Work on intonation to emphasize key points for higher bands.",
    },
    {
      assignmentTitle: "Section 3 University Projects",
      studentEmail: "li.huang@ielts.local",
      status: SubmissionStatus.submitted,
      submittedOffsetDays: -1,
      graderEmail: "sarah.tutor@ielts.local",
      rawScore: 7.5,
      finalScore: 7.5,
      feedback:
        "Accurate answers with effective note-taking strategies. Maintain focus during multi-speaker sections.",
    },
    {
      assignmentTitle: "General Training Letter: Workplace Equipment",
      studentEmail: "diego.rojas@ielts.local",
      status: SubmissionStatus.submitted,
      submittedOffsetDays: 0,
      graderEmail: "david.tutor@ielts.local",
      rawScore: 7.0,
      finalScore: 7.0,
      feedback:
        "Clear purpose and tone with sufficient detail. Add more persuasive language to reach Band 8.",
    },
  ];

  const submissions: Submission[] = [];

  for (const seed of submissionSeeds) {
    const assignment = assignmentByTitle.get(seed.assignmentTitle);
    if (!assignment) {
      throw new Error(`Missing assignment for submission ${seed.assignmentTitle}`);
    }
    const student = userByEmail.get(seed.studentEmail);
    const grader = userByEmail.get(seed.graderEmail);
    if (!student || !grader) {
      throw new Error(`Missing user for submission ${seed.assignmentTitle}`);
    }

    const payload: Prisma.InputJsonObject = {
      artifact: seed.assignmentTitle,
      resources: [
        {
          label: "Primary Submission",
          url: `https://storage.mock/ielts/${assignment.id}/${student.id}.pdf`,
        },
      ],
    };

    const submission = await prisma.submission.create({
      data: {
        assignmentId: assignment.id,
        studentId: student.id,
        status: seed.status,
        submittedAt: daysFromNow(seed.submittedOffsetDays),
        payload,
      },
    });

    submissions.push(submission);

    const rubricBreakdown: Prisma.InputJsonArray = [
      { criterion: "Task Achievement", points: seed.finalScore >= 7 ? 7 : 6 },
      { criterion: "Coherence & Cohesion", points: seed.finalScore },
      { criterion: "Lexical Resource", points: seed.finalScore },
      { criterion: "Grammatical Range & Accuracy", points: seed.finalScore - 0.5 },
    ];

    await prisma.grade.create({
      data: {
        submissionId: submission.id,
        graderId: grader.id,
        rubricBreakdown,
        rawScore: new Prisma.Decimal(seed.rawScore),
        adjustments: seed.adjustments ?? [],
        finalScore: new Prisma.Decimal(seed.finalScore),
        feedback: seed.feedback,
        gradedAt: daysFromNow(-1),
      },
    });
  }

  console.info("Creating IELTS notifications...");
  const notificationSeeds: Array<{
    userEmail: string;
    type: string;
    channel: NotificationChannel;
    status: NotificationStatus;
    sentOffsetDays: number | null;
    readOffsetDays?: number | null;
    payload: Prisma.InputJsonObject;
  }> = [
    {
      userEmail: "amelia.chan@ielts.local",
      type: "assignment_due_soon",
      channel: NotificationChannel.email,
      status: NotificationStatus.sent,
      sentOffsetDays: -2,
      readOffsetDays: -1,
      payload: {
        title: "Essay due soon",
        assignmentTitle: "Academic Essay: Technology and Society",
      },
    },
    {
      userEmail: "noah.patel@ielts.local",
      type: "submission_received",
      channel: NotificationChannel.inapp,
      status: NotificationStatus.read,
      sentOffsetDays: -1,
      readOffsetDays: 0,
      payload: {
        assignmentTitle: "Data Interpretation Task 1: Global Energy Mix",
        status: "late",
      },
    },
    {
      userEmail: "fatima.ahmed@ielts.local",
      type: "feedback_released",
      channel: NotificationChannel.push,
      status: NotificationStatus.sent,
      sentOffsetDays: -1,
      payload: {
        assignmentTitle: "Part 2 Cue Card: Memorable Journey",
        finalScore: 7.0,
      },
    },
    {
      userEmail: "li.huang@ielts.local",
      type: "listening_lab_reminder",
      channel: NotificationChannel.sms,
      status: NotificationStatus.queued,
      sentOffsetDays: null,
      payload: {
        session: "Listening Lab",
        startTime:
          courseByTitle.get("IELTS Listening Lab")?.createdAt ?? new Date(),
      },
    },
    {
      userEmail: "diego.rojas@ielts.local",
      type: "grade_available",
      channel: NotificationChannel.email,
      status: NotificationStatus.sent,
      sentOffsetDays: 0,
      payload: {
        assignmentTitle: "General Training Letter: Workplace Equipment",
        finalScore: 7.0,
      },
    },
    {
      userEmail: "sofia.mendes@ielts.local",
      type: "schedule_update",
      channel: NotificationChannel.inapp,
      status: NotificationStatus.sent,
      sentOffsetDays: -3,
      payload: {
        courseTitle: "IELTS Speaking Masterclass",
        message: "Session start time adjusted to 07:30.",
      },
    },
    {
      userEmail: "sarah.tutor@ielts.local",
      type: "new_submission",
      channel: NotificationChannel.email,
      status: NotificationStatus.sent,
      sentOffsetDays: -1,
      payload: {
        assignmentTitle: "Section 3 University Projects",
        student: "Li Huang",
      },
    },
    {
      userEmail: "david.tutor@ielts.local",
      type: "speaking_recording_uploaded",
      channel: NotificationChannel.push,
      status: NotificationStatus.sent,
      sentOffsetDays: -2,
      payload: {
        assignmentTitle: "Part 3 Discussion: Urban Living",
        student: "Fatima Ahmed",
      },
    },
  ];

  await Promise.all(
    notificationSeeds.map((seed) => {
      const user = userByEmail.get(seed.userEmail);
      if (!user) {
        throw new Error(`Missing user for notification ${seed.type}`);
      }
      return prisma.notification.create({
        data: {
          userId: user.id,
          type: seed.type,
          payload: seed.payload,
          channel: seed.channel,
          status: seed.status,
          sentAt:
            seed.sentOffsetDays !== null
              ? daysFromNow(seed.sentOffsetDays)
              : null,
          readAt:
            seed.readOffsetDays !== undefined && seed.readOffsetDays !== null
              ? daysFromNow(seed.readOffsetDays)
              : null,
        },
      });
    })
  );

  console.info("Creating IELTS files...");
  const fileSeeds: Array<{
    ownerEmail: string;
    bucket: string;
    key: string;
    mime: string;
    size: number;
  }> = [
    {
      ownerEmail: "amelia.chan@ielts.local",
      bucket: "ielts-mock",
      key: "writing/technology-society/amelia.pdf",
      mime: "application/pdf",
      size: 48211,
    },
    {
      ownerEmail: "noah.patel@ielts.local",
      bucket: "ielts-mock",
      key: "writing/energy-mix/noah.xlsx",
      mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      size: 23102,
    },
    {
      ownerEmail: "fatima.ahmed@ielts.local",
      bucket: "ielts-mock",
      key: "speaking/cue-card/fatima.mp3",
      mime: "audio/mpeg",
      size: 3489120,
    },
    {
      ownerEmail: "li.huang@ielts.local",
      bucket: "ielts-mock",
      key: "listening/section3/li-answer-sheet.pdf",
      mime: "application/pdf",
      size: 39012,
    },
    {
      ownerEmail: "diego.rojas@ielts.local",
      bucket: "ielts-mock",
      key: "writing/general-letter/diego.docx",
      mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      size: 51200,
    },
  ];

  const files = await Promise.all(
    fileSeeds.map((seed) => {
      const owner = userByEmail.get(seed.ownerEmail);
      if (!owner) {
        throw new Error(`Missing user for file ${seed.key}`);
      }
      const checksum = createHash("sha256")
        .update(`${seed.ownerEmail}-${seed.key}`)
        .digest("hex");
      return prisma.file.create({
        data: {
          ownerId: owner.id,
          bucket: seed.bucket,
          objectKey: seed.key,
          mime: seed.mime,
          size: seed.size,
          checksum,
        },
      });
    })
  );

  const fileByKey = new Map(files.map((file) => [file.objectKey, file]));

  console.info("Creating IELTS file submissions with metadata...");
  const fileSubmissionSeeds: Array<{
    assignmentTitle: string;
    studentEmail: string;
    fileKey: string;
    submittedOffsetDays: number;
    status: SubmissionStatus;
    version?: number;
    graderEmail?: string;
    rawScore?: number;
    finalScore?: number;
    feedback?: string;
    adjustments?: Prisma.InputJsonArray;
  }> = [
    {
      assignmentTitle: "Data Interpretation Task 1: Global Energy Mix",
      studentEmail: "amelia.chan@ielts.local",
      fileKey: "writing/technology-society/amelia.pdf",
      submittedOffsetDays: -1,
      status: SubmissionStatus.graded,
      version: 1,
      graderEmail: "sarah.tutor@ielts.local",
      rawScore: 7.5,
      finalScore: 7.0,
      feedback:
        "Solid comparisons and structure. Tighten the conclusion to keep it concise for a higher band.",
    },
    {
      assignmentTitle: "Part 3 Discussion: Urban Living",
      studentEmail: "fatima.ahmed@ielts.local",
      fileKey: "speaking/cue-card/fatima.mp3",
      submittedOffsetDays: -2,
      status: SubmissionStatus.submitted,
      version: 1,
    },
    {
      assignmentTitle: "Section 3 University Projects",
      studentEmail: "diego.rojas@ielts.local",
      fileKey: "writing/general-letter/diego.docx",
      submittedOffsetDays: -1,
      status: SubmissionStatus.graded,
      version: 2,
      graderEmail: "david.tutor@ielts.local",
      rawScore: 7.0,
      finalScore: 7.0,
      feedback:
        "Clear answers with improved accuracy. Keep practicing paraphrasing to push into Band 8.",
    },
    {
      assignmentTitle: "Listening Mock Test: Band 7 Target",
      studentEmail: "li.huang@ielts.local",
      fileKey: "listening/section3/li-answer-sheet.pdf",
      submittedOffsetDays: 13,
      status: SubmissionStatus.late,
      version: 1,
      graderEmail: "sarah.tutor@ielts.local",
      rawScore: 6.5,
      finalScore: 6.0,
      feedback:
        "Good overall accuracy, but late submission reduced the final score. Review section 4 detail traps.",
      adjustments: [{ reason: "late_submission", delta: -0.5 }] as Prisma.InputJsonArray,
    },
  ];

  for (const seed of fileSubmissionSeeds) {
    const assignment = assignmentByTitle.get(seed.assignmentTitle);
    if (!assignment) {
      throw new Error(`Missing assignment for file submission ${seed.assignmentTitle}`);
    }
    const student = userByEmail.get(seed.studentEmail);
    if (!student) {
      throw new Error(`Missing user for file submission ${seed.assignmentTitle}`);
    }
    const file = fileByKey.get(seed.fileKey);
    if (!file) {
      throw new Error(`Missing file for file submission ${seed.fileKey}`);
    }

    const name =
      file.objectKey.split("/").pop() ?? file.objectKey;

    const payload: Prisma.InputJsonObject = {
      studentName: student.fullName,
      version: seed.version ?? 1,
      files: [
        {
          id: file.id,
          name,
          size: file.size,
          mime: file.mime,
          checksum: file.checksum,
          bucket: file.bucket,
          objectKey: file.objectKey,
        },
      ],
    };

    const submission = await prisma.submission.create({
      data: {
        assignmentId: assignment.id,
        studentId: student.id,
        status: seed.status,
        submittedAt: daysFromNow(seed.submittedOffsetDays),
        payload,
      },
    });

    submissions.push(submission);

    if (seed.graderEmail && seed.rawScore !== undefined && seed.finalScore !== undefined) {
      const grader = userByEmail.get(seed.graderEmail);
      if (!grader) {
        throw new Error(`Missing grader for file submission ${seed.assignmentTitle}`);
      }

      const rubricBreakdown: Prisma.InputJsonArray = [
        { criterion: "Task Achievement", points: seed.finalScore >= 7 ? 7 : 6 },
        { criterion: "Coherence & Cohesion", points: seed.finalScore },
        { criterion: "Lexical Resource", points: seed.finalScore },
        { criterion: "Grammatical Range & Accuracy", points: seed.finalScore - 0.5 },
      ];

      const gradedOffsetDays = Math.min(seed.submittedOffsetDays + 1, 0);

      await prisma.grade.create({
        data: {
          submissionId: submission.id,
          graderId: grader.id,
          rubricBreakdown,
          rawScore: new Prisma.Decimal(seed.rawScore),
          adjustments: seed.adjustments ?? [],
          finalScore: new Prisma.Decimal(seed.finalScore),
          feedback: seed.feedback ?? null,
          gradedAt: daysFromNow(gradedOffsetDays),
        },
      });
    }
  }

  console.info("Creating IELTS auth sessions...");
  const sessionSeeds: Array<{
    userEmail: string;
    expiresInDays: number;
    revokedInDays?: number | null;
    userAgent?: string;
    ip?: string;
  }> = [
    {
      userEmail: "sarah.tutor@ielts.local",
      expiresInDays: 14,
      userAgent: "Mozilla/5.0 (Macintosh)",
      ip: "192.168.0.11",
    },
    {
      userEmail: "david.tutor@ielts.local",
      expiresInDays: 7,
      revokedInDays: -2,
      userAgent: "Mozilla/5.0 (Windows NT 10.0)",
      ip: "10.0.0.22",
    },
    {
      userEmail: "amelia.chan@ielts.local",
      expiresInDays: 21,
      userAgent: "Mozilla/5.0 (iPhone)",
      ip: "172.16.0.3",
    },
    {
      userEmail: "li.huang@ielts.local",
      expiresInDays: 2,
      userAgent: "Mozilla/5.0 (Android)",
      ip: "172.16.0.12",
    },
    {
      userEmail: "sofia.mendes@ielts.local",
      expiresInDays: 1,
      revokedInDays: -1,
      userAgent: "Mozilla/5.0 (iPad)",
      ip: "192.168.0.45",
    },
  ];

  const sessionHashes = await Promise.all(
    sessionSeeds.map(() => bcrypt.hash(randomBytes(32).toString("hex"), 8))
  );

  await Promise.all(
    sessionSeeds.map((seed, index) => {
      const user = userByEmail.get(seed.userEmail);
      if (!user) {
        throw new Error(`Missing user for session ${seed.userEmail}`);
      }
      const ipHash = seed.ip
        ? createHash("sha256").update(seed.ip).digest("hex")
        : null;
      return prisma.authSession.create({
        data: {
          userId: user.id,
          refreshTokenHash: sessionHashes[index],
          userAgent: seed.userAgent,
          ipHash,
          expiresAt: daysFromNow(seed.expiresInDays),
          revokedAt:
            seed.revokedInDays !== undefined && seed.revokedInDays !== null
              ? daysFromNow(seed.revokedInDays)
              : null,
        },
      });
    })
  );

  console.info("Creating IELTS identities...");
  const identitySeeds: Array<{
    userEmail: string;
    provider: IdentityProvider;
    providerSubject: string;
    providerIssuer: string;
    emailVerified: boolean;
  }> = [
    {
      userEmail: "rosa.admin@ielts.local",
      provider: IdentityProvider.password,
      providerSubject: "rosa-admin-password",
      providerIssuer: "local",
      emailVerified: true,
    },
    {
      userEmail: "sarah.tutor@ielts.local",
      provider: IdentityProvider.google,
      providerSubject: "google-oauth2|sarah.tutor",
      providerIssuer: "https://accounts.google.com",
      emailVerified: true,
    },
    {
      userEmail: "david.tutor@ielts.local",
      provider: IdentityProvider.password,
      providerSubject: "david-teacher-local",
      providerIssuer: "local",
      emailVerified: true,
    },
    {
      userEmail: "amelia.chan@ielts.local",
      provider: IdentityProvider.password,
      providerSubject: "amelia-student",
      providerIssuer: "local",
      emailVerified: true,
    },
    {
      userEmail: "noah.patel@ielts.local",
      provider: IdentityProvider.google,
      providerSubject: "google-oauth2|noah.patel",
      providerIssuer: "https://accounts.google.com",
      emailVerified: true,
    },
    {
      userEmail: "fatima.ahmed@ielts.local",
      provider: IdentityProvider.password,
      providerSubject: "fatima-password",
      providerIssuer: "local",
      emailVerified: false,
    },
    {
      userEmail: "diego.rojas@ielts.local",
      provider: IdentityProvider.password,
      providerSubject: "diego-password",
      providerIssuer: "local",
      emailVerified: true,
    },
  ];

  await Promise.all(
    identitySeeds.map((seed) => {
      const user = userByEmail.get(seed.userEmail);
      if (!user) {
        throw new Error(`Missing user for identity ${seed.providerSubject}`);
      }
      return prisma.identity.create({
        data: {
          userId: user.id,
          provider: seed.provider,
          providerSubject: seed.providerSubject,
          providerIssuer: seed.providerIssuer,
          email: seed.userEmail,
          emailVerified: seed.emailVerified,
        },
      });
    })
  );

  console.info("Creating IELTS audit logs...");
  const auditSeeds: Array<{
    actorEmail: string | null;
    action: string;
    entity: string;
    entityLookup: () => { id: string };
    diff: Prisma.InputJsonValue;
  }> = [
    {
      actorEmail: "rosa.admin@ielts.local",
      action: "user.invited",
      entity: "users",
      entityLookup: () => {
        const user = userByEmail.get("fatima.ahmed@ielts.local");
        if (!user) {
          throw new Error("Missing entity for audit log (Fatima)");
        }
        return { id: user.id };
      },
      diff: { status: { from: "invited", to: "active" } },
    },
    {
      actorEmail: "sarah.tutor@ielts.local",
      action: "course.created",
      entity: "courses",
      entityLookup: () => {
        const course = courseByTitle.get("IELTS Academic Writing Bootcamp");
        if (!course) {
          throw new Error("Missing course for audit log");
        }
        return { id: course.id };
      },
      diff: { title: "IELTS Academic Writing Bootcamp" },
    },
    {
      actorEmail: "david.tutor@ielts.local",
      action: "assignment.published",
      entity: "assignments",
      entityLookup: () => {
        const assignment = assignmentByTitle.get(
          "Part 2 Cue Card: Memorable Journey"
        );
        if (!assignment) {
          throw new Error("Missing assignment for audit log");
        }
        return { id: assignment.id };
      },
      diff: { publishedAt: daysFromNow(-1).toISOString() },
    },
    {
      actorEmail: "sarah.tutor@ielts.local",
      action: "grade.released",
      entity: "grades",
      entityLookup: () => {
        const submission = submissions[0];
        if (!submission) {
          throw new Error("Missing submission for audit log");
        }
        return { id: submission.id };
      },
      diff: { finalScore: 7.5 },
    },
    {
      actorEmail: null,
      action: "system.cleanup",
      entity: "cron",
      entityLookup: () => ({ id: "scheduled-task" }),
      diff: { detail: "Expired sessions revoked" },
    },
  ];

  await Promise.all(
    auditSeeds.map((seed) => {
      const actor = seed.actorEmail ? userByEmail.get(seed.actorEmail) : null;
      const entity = seed.entityLookup();
      return prisma.auditLog.create({
        data: {
          actorId: actor?.id ?? null,
          action: seed.action,
          entity: seed.entity,
          entityId: entity.id,
          diff: seed.diff,
        },
      });
    })
  );

  console.info("Seed completed successfully.");
  console.table({
    users: users.length,
    courses: createdCourses.length,
    assignments: assignments.length,
    submissions: submissions.length,
    rubrics: rubrics.length,
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error("Seeding failed:", error);
    await prisma.$disconnect();
    process.exit(1);
  });
