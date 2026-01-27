/**
 * File: src/prisma/seedIeltsAssignments.ts
 * Purpose: Seed IELTS assignments without wiping existing data.
 * Why: Allows adding/updating IELTS assignment configs while preserving other records.
 */
import { AssignmentType, Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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
    courseTitle: "IELTS Academic Writing Bootcamp",
    title: "Academic Essay: Technology and Society",
    description:
      "Write a 250-word Task 2 response discussing whether increasing reliance on technology benefits society.",
    type: AssignmentType.writing,
    dueInDays: 5,
    latePenaltyPercent: 10,
    assignmentConfig: {
      version: 1,
      timing: { enabled: true, durationMinutes: 60, enforce: false },
      instructions:
        "Write a Task 2 essay. Use formal academic tone and support your arguments with examples.",
      attempts: { maxAttempts: null },
      task1: {
        prompt: "Summarize the chart or process in at least 150 words (Task 1).",
        imageFileId: null,
      },
      task2: {
        prompt:
          "Discuss whether increasing reliance on technology benefits society (Task 2).",
      },
    },
  },
  {
    courseTitle: "IELTS Academic Writing Bootcamp",
    title: "Data Interpretation Task 1: Global Energy Mix",
    description:
      "Summarize the main trends from the provided chart comparing global energy sources between 1990 and 2030.",
    type: AssignmentType.writing,
    dueInDays: 10,
    latePenaltyPercent: 15,
    assignmentConfig: {
      version: 1,
      timing: { enabled: true, durationMinutes: 60, enforce: false },
      instructions:
        "Complete Task 1 and Task 2. Focus on summarizing trends clearly.",
      attempts: { maxAttempts: null },
      task1: {
        prompt:
          "Summarize the main trends from the energy mix chart in at least 150 words.",
        imageFileId: null,
      },
      task2: {
        prompt:
          "Explain how energy choices might shift in the next decade and why.",
      },
    },
  },
  {
    courseTitle: "IELTS Speaking Masterclass",
    title: "Part 2 Cue Card: Memorable Journey",
    description:
      "Record a two-minute response to the cue card about a memorable journey, focusing on coherence and fluency.",
    type: AssignmentType.speaking,
    dueInDays: 3,
    latePenaltyPercent: 5,
    assignmentConfig: {
      version: 1,
      timing: { enabled: true, durationMinutes: 15, enforce: false },
      instructions: "Complete all three parts. Record your response for Part 2.",
      attempts: { maxAttempts: null },
      part1: {
        questions: ["Do you enjoy traveling?", "How often do you take trips?"],
      },
      part2: {
        cueCard: {
          topic: "A memorable journey you took",
          bulletPoints: [
            "Where you went",
            "Who you went with",
            "What happened on the trip",
            "Why it was memorable",
          ],
        },
        prepSeconds: 60,
        talkSeconds: 120,
      },
      part3: {
        questions: [
          "How has travel changed in recent years?",
          "What are the benefits of traveling with family?",
        ],
      },
    },
  },
  {
    courseTitle: "IELTS Speaking Masterclass",
    title: "Part 3 Discussion: Urban Living",
    description:
      "Submit a recorded discussion on the pros and cons of living in a large city versus a small town.",
    type: AssignmentType.speaking,
    dueInDays: 8,
    latePenaltyPercent: 10,
    assignmentConfig: {
      version: 1,
      timing: { enabled: true, durationMinutes: 15, enforce: false },
      instructions:
        "Answer the discussion questions with clear examples and comparisons.",
      attempts: { maxAttempts: null },
      part1: {
        questions: [
          "Do you live in a city or a town?",
          "What do you like about where you live?",
        ],
      },
      part2: {
        cueCard: {
          topic: "A place you enjoy in your hometown",
          bulletPoints: [
            "Where it is",
            "What you do there",
            "Who you go with",
            "Why you like it",
          ],
        },
        prepSeconds: 60,
        talkSeconds: 120,
      },
      part3: {
        questions: [
          "What are the main advantages of city life?",
          "How can cities become more livable?",
        ],
      },
    },
  },
  {
    courseTitle: "IELTS Listening Lab",
    title: "Section 3 University Projects",
    description:
      "Complete the listening comprehension questions for the Section 3 recording and upload your answer sheet.",
    type: AssignmentType.listening,
    dueInDays: 4,
    latePenaltyPercent: 10,
    assignmentConfig: {
      version: 1,
      timing: { enabled: true, durationMinutes: 30, enforce: true },
      instructions: "Listen to the recording once and answer all questions.",
      attempts: { maxAttempts: null },
      sections: [
        {
          id: "sec-1",
          title: "Section 3",
          audioFileId: null,
          playback: { limitPlays: 1 },
          questions: [],
        },
      ],
    },
  },
  {
    courseTitle: "IELTS Listening Lab",
    title: "Gap Fill Drill: Renewable Energy Lecture",
    description:
      "Fill in the missing words from the lecture transcript to practice predictive listening strategies.",
    type: AssignmentType.listening,
    dueInDays: 9,
    latePenaltyPercent: 5,
    assignmentConfig: {
      version: 1,
      timing: { enabled: true, durationMinutes: 20, enforce: false },
      instructions: "Complete the gap-fill questions while listening to the lecture.",
      attempts: { maxAttempts: null },
      sections: [
        {
          id: "sec-1",
          title: "Lecture",
          audioFileId: null,
          playback: { limitPlays: 0 },
          questions: [],
        },
      ],
    },
  },
  {
    courseTitle: "IELTS Reading Strategies Workshop",
    title: "True/False/Not Given Drill",
    description:
      "Answer T/F/NG questions from a sample Academic passage focusing on inference and paraphrasing.",
    type: AssignmentType.reading,
    dueInDays: 6,
    latePenaltyPercent: 5,
    assignmentConfig: {
      version: 1,
      timing: { enabled: true, durationMinutes: 60, enforce: false },
      instructions:
        "Read the passage and answer all True/False/Not Given questions.",
      attempts: { maxAttempts: null },
      sections: [
        {
          id: "sec-1",
          title: "Passage 1",
          passage: `Urban beekeeping has grown rapidly in the last decade. Supporters claim that rooftop hives can improve pollination and provide residents with a tangible connection to local food systems. City councils have responded by creating guidelines on hive placement, water access, and responsible pest control. Critics, however, worry about public safety and the potential for disease transmission between densely packed colonies. They argue that a poorly managed hive can stress nearby wild pollinators, especially when floral resources are limited.

Recent monitoring programs suggest that most urban hives remain healthy when beekeepers follow basic biosecurity steps. These include routine inspections for mites, rotating frames to prevent overcrowding, and maintaining diverse forage areas. The data also show that hive productivity varies widely by neighborhood. Areas with mixed residential gardens, small parks, and flowering street trees tend to produce more stable yields than districts dominated by hard surfaces.

Nevertheless, researchers caution against assuming that more hives automatically equals better outcomes. Pollinator experts point out that native bees often have narrower diets than honeybees. When a city adds large numbers of managed hives, competition for nectar can increase during dry spells or late summer, leading to lower survival rates for wild species. Balanced policies, they suggest, should prioritize habitat restoration, limit hive density, and encourage a variety of flowering plants throughout the season.`,
          questions: [
            {
              id: "rb-q1",
              type: "multiple_choice",
              prompt:
                "Why have city councils created guidelines for urban beekeeping?",
              options: [
                "To increase honey production quotas",
                "To regulate hive placement and public safety",
                "To ban beekeeping in residential areas",
                "To require professional beekeeping licenses",
              ],
              answer: "To regulate hive placement and public safety",
            },
            {
              id: "rb-q2",
              type: "true_false_not_given",
              statement:
                "Critics believe that disease transmission is more likely in cities because wild bees live longer there.",
              answer: "not_given",
            },
            {
              id: "rb-q3",
              type: "sentence_completion",
              instructions: "Complete the sentence with ONE or TWO words.",
              sentences: [
                {
                  id: "rb-sc1",
                  text: "Urban hives are often placed on ________ to improve pollination in cities.",
                  answer: "rooftops",
                },
              ],
            },
            {
              id: "rb-q4",
              type: "matching_information",
              instructions:
                "Match each statement with the correct paragraph (A, B, or C).",
              statements: [
                {
                  id: "rb-mi1",
                  text: "Hive productivity differs between neighborhoods.",
                  answerParagraph: "B",
                },
                {
                  id: "rb-mi2",
                  text: "Adding many managed hives can harm wild species in some seasons.",
                  answerParagraph: "C",
                },
              ],
            },
            {
              id: "rb-q5",
              type: "matching_headings",
              instructions:
                "Choose the correct heading for each paragraph (A-C).",
              headings: [
                { id: "rb-h1", text: "Urban enthusiasm and emerging concerns" },
                { id: "rb-h2", text: "Management practices and yield patterns" },
                { id: "rb-h3", text: "Competition with native pollinators" },
                { id: "rb-h4", text: "Historical uses of honeybee products" },
              ],
              items: [
                { paragraph: "A", answerHeadingId: "rb-h1" },
                { paragraph: "B", answerHeadingId: "rb-h2" },
                { paragraph: "C", answerHeadingId: "rb-h3" },
              ],
            },
            {
              id: "rb-q6",
              type: "matching_features",
              instructions:
                "Match each statement with the group it refers to.",
              features: [
                { id: "rb-f1", label: "Supporters" },
                { id: "rb-f2", label: "Critics" },
                { id: "rb-f3", label: "Researchers" },
              ],
              statements: [
                {
                  id: "rb-mf1",
                  text: "Argue that urban hives connect people to local food systems.",
                  answerFeatureId: "rb-f1",
                },
                {
                  id: "rb-mf2",
                  text: "Warn that unmanaged hives may stress wild pollinators.",
                  answerFeatureId: "rb-f2",
                },
                {
                  id: "rb-mf3",
                  text: "Recommend limiting hive density and restoring habitat.",
                  answerFeatureId: "rb-f3",
                },
              ],
            },
            {
              id: "rb-q7",
              type: "multiple_choice",
              prompt:
                "Which area is most likely to produce stable honey yields?",
              options: [
                "Districts with extensive hard surfaces",
                "Neighborhoods with mixed gardens and flowering trees",
                "Industrial zones with warehouses",
                "Areas without street trees",
              ],
              answer: "Neighborhoods with mixed gardens and flowering trees",
            },
          ],
        },
      ],
    },
  },
  {
    courseTitle: "IELTS Reading Strategies Workshop",
    title: "Matching Headings Practice",
    description:
      "Match paragraph headings with the provided reading passage and justify each decision.",
    type: AssignmentType.reading,
    dueInDays: 11,
    latePenaltyPercent: 10,
    assignmentConfig: {
      version: 1,
      timing: { enabled: true, durationMinutes: 60, enforce: false },
      instructions: "Match headings to paragraphs based on the passage content.",
      attempts: { maxAttempts: null },
      sections: [
        {
          id: "sec-1",
          title: "Passage 1",
          passage: `In the early twentieth century, archaeologists relied heavily on relative dating, comparing layers of soil to determine which artifacts were older or newer. This approach could establish a sequence but not precise dates. The development of radiocarbon techniques in the mid century changed the field by assigning ages to organic materials, yet the method depends on calibration curves that vary by region and time period.

Tree ring analysis, known as dendrochronology, provides an alternative source of precise dating. By matching patterns of wide and narrow rings, researchers can align wood samples with established timelines. In some cases, the method extends several thousand years into the past. However, its usefulness is limited in areas without long lived tree species or in climates where growth rings are indistinct.

To improve accuracy, teams increasingly combine multiple dating techniques. A wooden beam may be dated through tree rings, while associated charcoal is analyzed with radiocarbon methods. If the results converge, the confidence in the timeline increases. If they do not, researchers must examine whether the sample was reused, contaminated, or moved from its original context.`,
          questions: [
            {
              id: "rd-q1",
              type: "true_false_not_given",
              statement:
                "Relative dating can determine the exact age of an artifact.",
              answer: "false",
            },
            {
              id: "rd-q2",
              type: "multiple_choice",
              prompt:
                "What is one limitation of radiocarbon dating mentioned in the passage?",
              options: [
                "It can only be used on metals",
                "It depends on regional calibration curves",
                "It cannot be used on organic materials",
                "It is less accurate than relative dating",
              ],
              answer: "It depends on regional calibration curves",
            },
            {
              id: "rd-q3",
              type: "sentence_completion",
              instructions: "Complete the sentence with ONE word.",
              sentences: [
                {
                  id: "rd-sc1",
                  text: "Dendrochronology aligns wood samples by matching ________ patterns.",
                  answer: "ring",
                },
              ],
            },
            {
              id: "rd-q4",
              type: "matching_headings",
              instructions:
                "Choose the correct heading for each paragraph (A-C).",
              headings: [
                { id: "rd-h1", text: "Limits of tree-ring methods" },
                { id: "rd-h2", text: "Combining methods for stronger evidence" },
                { id: "rd-h3", text: "From relative to radiocarbon dating" },
                { id: "rd-h4", text: "Excavation tools used in deserts" },
              ],
              items: [
                { paragraph: "A", answerHeadingId: "rd-h3" },
                { paragraph: "B", answerHeadingId: "rd-h1" },
                { paragraph: "C", answerHeadingId: "rd-h2" },
              ],
            },
            {
              id: "rd-q5",
              type: "matching_information",
              instructions:
                "Match each statement with the correct paragraph (A, B, or C).",
              statements: [
                {
                  id: "rd-mi1",
                  text: "Researchers may need to check if samples were moved.",
                  answerParagraph: "C",
                },
                {
                  id: "rd-mi2",
                  text: "A dating method can extend thousands of years in some regions.",
                  answerParagraph: "B",
                },
              ],
            },
            {
              id: "rd-q6",
              type: "matching_features",
              instructions:
                "Match each statement with the method it describes.",
              features: [
                { id: "rd-f1", label: "Relative dating" },
                { id: "rd-f2", label: "Radiocarbon dating" },
                { id: "rd-f3", label: "Dendrochronology" },
              ],
              statements: [
                {
                  id: "rd-mf1",
                  text: "Orders artifacts by soil layers.",
                  answerFeatureId: "rd-f1",
                },
                {
                  id: "rd-mf2",
                  text: "Requires calibration curves for accuracy.",
                  answerFeatureId: "rd-f2",
                },
                {
                  id: "rd-mf3",
                  text: "Matches wide and narrow growth patterns.",
                  answerFeatureId: "rd-f3",
                },
              ],
            },
            {
              id: "rd-q7",
              type: "multiple_choice",
              prompt:
                "Why do researchers combine dating techniques when possible?",
              options: [
                "To avoid using organic samples",
                "To reduce excavation time",
                "To increase confidence in dates",
                "To replace relative dating entirely",
              ],
              answer: "To increase confidence in dates",
            },
          ],
        },
      ],
    },
  },
  {
    courseTitle: "IELTS General Training Fast Track",
    title: "General Training Letter: Workplace Equipment",
    description:
      "Write a Task 1 letter to your manager requesting new equipment and explaining the benefits.",
    type: AssignmentType.writing,
    dueInDays: 7,
    latePenaltyPercent: 5,
    assignmentConfig: {
      version: 1,
      timing: { enabled: true, durationMinutes: 60, enforce: false },
      instructions:
        "Complete Task 1 letter writing and Task 2 essay responses.",
      attempts: { maxAttempts: null },
      task1: {
        prompt:
          "Write a letter requesting new workplace equipment and explain why it is needed.",
        imageFileId: null,
      },
      task2: {
        prompt: "Discuss how workplace tools influence productivity and morale.",
      },
    },
  },
  {
    courseTitle: "IELTS General Training Fast Track",
    title: "Listening Mock Test: Band 7 Target",
    description:
      "Complete the listening mock test, aiming for band 7 accuracy, and upload the answer sheet.",
    type: AssignmentType.listening,
    dueInDays: 12,
    latePenaltyPercent: 10,
    assignmentConfig: {
      version: 1,
      timing: { enabled: true, durationMinutes: 30, enforce: true },
      instructions: "Complete the full listening mock test in one sitting.",
      attempts: { maxAttempts: null },
      sections: [
        {
          id: "sec-1",
          title: "Section 1",
          audioFileId: null,
          playback: { limitPlays: 1 },
          questions: [],
        },
        {
          id: "sec-2",
          title: "Section 2",
          audioFileId: null,
          playback: { limitPlays: 1 },
          questions: [],
        },
        {
          id: "sec-3",
          title: "Section 3",
          audioFileId: null,
          playback: { limitPlays: 1 },
          questions: [],
        },
        {
          id: "sec-4",
          title: "Section 4",
          audioFileId: null,
          playback: { limitPlays: 1 },
          questions: [],
        },
      ],
    },
  },
];

async function main(): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to seed in production mode.");
  }

  const courseTitles = Array.from(
    new Set(assignmentSeeds.map((seed) => seed.courseTitle))
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
      type: "percent",
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
    `IELTS assignments seed complete (created=${created}, updated=${updated}).`
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error("IELTS assignment seed failed:", error);
    await prisma.$disconnect();
    process.exit(1);
  });
