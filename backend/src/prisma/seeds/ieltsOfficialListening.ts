/**
 * File: src/prisma/seeds/ieltsOfficialListening.ts
 * Purpose: Build official-structure IELTS Listening assignment configs.
 * Why: Ensures seeds match realistic 4-section IELTS progression with authentic prompts and transcripts.
 */
import type { Prisma } from "../generated/client/client.js";
import { nullAttempts, type IeltsFixtureVariant } from "./ieltsOfficialShared.js";

const QUESTIONS_PER_SECTION = 10;
const LISTENING_SECTIONS = 4;

type ListeningQuestionDraft = {
  type:
    | "multiple_choice"
    | "completion"
    | "sentence_completion"
    | "short_answer"
    | "matching"
    | "map_diagram_labeling";
  prompt: string;
  answer: string;
  options?: [string, string, string, string];
};

const FULL_SECTION_TRANSCRIPTS = [
  `You will hear a conversation between a student and a housing office adviser about booking temporary accommodation. The student confirms move-in date, room type, weekly rent, payment deadline, and the documents needed on arrival. One date and one fee are corrected mid-conversation.

The adviser also explains laundry access, quiet-hour policy, and how maintenance requests should be submitted. This section reflects typical everyday transactional language with clear, concrete details.

Listen for final confirmed information rather than first mentions.`,
  `You will hear an orientation talk for new visitors at a coastal heritage park. The speaker describes the visitor route, shuttle stops, restricted zones, and the locations of the cafe, first-aid point, and information desk.

The guide compares old route instructions with a newly introduced one-way flow and gives practical advice for families, school groups, and photographers.

This section represents a public-information monologue with map-style references.`,
  `You will hear a discussion between two graduate students and their supervisor as they refine a research proposal. They evaluate methods, participant recruitment, data coding reliability, and task sequencing before agreeing on responsibilities and deadlines.

Several suggestions are rejected after discussion, and the supervisor asks the students to justify methodological choices with reference to prior studies.

This section reflects a semi-academic multi-speaker exchange with negotiation and revision.`,
  `You will hear part of a university lecture on restoring urban river corridors. The lecturer presents baseline contamination data, intervention phases, monitoring metrics, and cost-effectiveness findings, then critiques early assumptions made by the project team.

The lecture includes technical vocabulary, comparative evidence, and policy implications for long-term governance.

This section mirrors the densest IELTS listening input, requiring inference and precise detail tracking.`,
];

const LITE_SECTION_TRANSCRIPTS = [
  `You will hear a student call a housing office to confirm temporary accommodation details, including dates, fees, and required documents. Some details are corrected before the end of the call.`,
  `You will hear a park orientation talk describing routes, facilities, and visitor rules, including map-based references and revised movement guidance.`,
  `You will hear a supervisor meeting where two students refine methods, deadlines, and responsibilities for a research project.`,
  `You will hear an academic lecture excerpt about urban river restoration, evidence from project phases, and policy recommendations for long-term management.`,
];

const QUESTION_BANK: Array<ListeningQuestionDraft[]> = [
  [
    { type: "completion", prompt: "What is the confirmed move-in date for the student?", answer: "3 September" },
    { type: "completion", prompt: "Which room type does the student finally choose?", answer: "single ensuite" },
    { type: "sentence_completion", prompt: "The weekly rent is ____ pounds.", answer: "185" },
    { type: "completion", prompt: "What is the payment deadline stated by the adviser?", answer: "20 August" },
    { type: "short_answer", prompt: "Which identification document must be shown on arrival?", answer: "passport" },
    {
      type: "multiple_choice",
      prompt: "How should maintenance problems be reported?",
      options: ["By calling campus security", "Through the online portal", "At the reception desk only", "By emailing the landlord"],
      answer: "Through the online portal",
    },
    { type: "sentence_completion", prompt: "Quiet hours begin at ____ p.m.", answer: "10" },
    { type: "completion", prompt: "Laundry access is included ____ days a week.", answer: "7" },
    {
      type: "multiple_choice",
      prompt: "Why does the student reject the first room option?",
      options: ["It is outside the shuttle zone", "It does not include private bathroom facilities", "It requires a six-month contract", "It has no internet access"],
      answer: "It does not include private bathroom facilities",
    },
    { type: "short_answer", prompt: "Which office will send final booking confirmation?", answer: "Residential Services" },
  ],
  [
    { type: "map_diagram_labeling", prompt: "On the park map, which letter marks the first-aid station?", answer: "B" },
    { type: "map_diagram_labeling", prompt: "On the park map, which letter marks the photography lookout?", answer: "E" },
    { type: "completion", prompt: "The coastal shuttle leaves every ____ minutes.", answer: "20" },
    {
      type: "multiple_choice",
      prompt: "Why was the visitor route changed this season?",
      options: ["To shorten all walking distances", "To reduce crowding near fragile dunes", "To increase access to maintenance roads", "To move visitors closer to nesting sites"],
      answer: "To reduce crowding near fragile dunes",
    },
    { type: "matching", prompt: "Match the stop with its key feature: Stop 1.", answer: "ticket validation" },
    { type: "matching", prompt: "Match the stop with its key feature: Stop 2.", answer: "water refill point" },
    { type: "matching", prompt: "Match the stop with its key feature: Stop 3.", answer: "guided trail departure" },
    { type: "sentence_completion", prompt: "School groups must check in at the ____ before entering the trail.", answer: "north gate" },
    {
      type: "multiple_choice",
      prompt: "What is visitors' last chance to buy hot food?",
      options: ["14:30", "15:00", "15:30", "16:00"],
      answer: "15:30",
    },
    { type: "short_answer", prompt: "Which zone is closed during seabird nesting months?", answer: "cliff path" },
  ],
  [
    {
      type: "multiple_choice",
      prompt: "What main problem does the supervisor identify in the initial design?",
      options: ["The target sample is too broad for the timeline", "The project budget exceeds faculty policy", "The topic duplicates last semester's dissertation", "The ethics form was submitted to the wrong office"],
      answer: "The target sample is too broad for the timeline",
    },
    { type: "completion", prompt: "What is the final deadline for pilot data collection?", answer: "27 October" },
    { type: "sentence_completion", prompt: "Inter-rater agreement will be checked after coding the first ____ interviews.", answer: "12" },
    {
      type: "multiple_choice",
      prompt: "How will participants primarily be recruited?",
      options: ["Open social media advertising", "Invitations through departmental mailing lists", "Street-based recruitment near campus", "Paid recruitment agency referrals"],
      answer: "Invitations through departmental mailing lists",
    },
    { type: "matching", prompt: "Match each task to the responsible person: literature synthesis.", answer: "Mina" },
    { type: "matching", prompt: "Match each task to the responsible person: interview scheduling.", answer: "Carlos" },
    { type: "matching", prompt: "Match each task to the responsible person: statistics support.", answer: "Dr Lee" },
    {
      type: "multiple_choice",
      prompt: "Which source type does the supervisor prioritize for the review?",
      options: ["Opinion editorials", "Methodologically comparable peer-reviewed studies", "Government press releases", "Conference posters without data"],
      answer: "Methodologically comparable peer-reviewed studies",
    },
    { type: "short_answer", prompt: "Which room code is booked for transcription training?", answer: "R2-14" },
    { type: "sentence_completion", prompt: "The final presentation must include a clear section on ____.", answer: "limitations" },
  ],
  [
    { type: "completion", prompt: "Before intervention, dissolved oxygen fell by ____ percent in dry months.", answer: "28" },
    { type: "completion", prompt: "Phase one focused on reducing inflow from ____ drains.", answer: "stormwater" },
    { type: "sentence_completion", prompt: "Reinstated vegetation increased bank ____ during heavy rainfall.", answer: "stability" },
    {
      type: "multiple_choice",
      prompt: "Which intervention produced the fastest measurable clarity improvement?",
      options: ["Volunteer litter patrols", "Reed-bed filtration channels", "Weekend boating restrictions", "Additional laboratory sampling"],
      answer: "Reed-bed filtration channels",
    },
    { type: "completion", prompt: "The monitoring program ran for ____ months before review.", answer: "24" },
    { type: "short_answer", prompt: "Which contaminant remained above target longest?", answer: "phosphates" },
    {
      type: "multiple_choice",
      prompt: "What funding model does the lecturer recommend for long-term monitoring?",
      options: ["Annual emergency bids only", "A rolling multi-year allocation with checkpoints", "Corporate sponsorship without public oversight", "One-off capital grants without review"],
      answer: "A rolling multi-year allocation with checkpoints",
    },
    { type: "sentence_completion", prompt: "Citizen scientists submitted records through the ____ platform.", answer: "RiverWatch" },
    { type: "completion", prompt: "Long-term success depended most on cross-agency ____.", answer: "coordination" },
    {
      type: "multiple_choice",
      prompt: "Which mistaken assumption does the lecturer explicitly reject?",
      options: ["Early gains mean maintenance can be reduced", "Community reporting improves data coverage", "Baseline testing is necessary before intervention", "Sediment control affects downstream quality"],
      answer: "Early gains mean maintenance can be reduced",
    },
  ],
];

function toListeningQuestion(id: string, draft: ListeningQuestionDraft): Prisma.InputJsonObject {
  return {
    id,
    type: draft.type,
    prompt: draft.prompt,
    options: draft.options ?? [],
    answer: draft.answer,
    correctAnswer: draft.answer,
  };
}

function buildSectionQuestions(sectionIndex: number, variant: IeltsFixtureVariant): Prisma.InputJsonObject[] {
  const sectionNumber = sectionIndex + 1;
  return QUESTION_BANK[sectionIndex].map((draft, offset) => {
    const questionNumber = sectionIndex * QUESTIONS_PER_SECTION + offset + 1;
    const id = `listening-${variant}-s${sectionNumber}-q${questionNumber}`;
    return toListeningQuestion(id, draft);
  });
}

function buildListeningConfig(variant: IeltsFixtureVariant): Prisma.InputJsonObject {
  const transcripts = variant === "full" ? FULL_SECTION_TRANSCRIPTS : LITE_SECTION_TRANSCRIPTS;

  const sections = Array.from({ length: LISTENING_SECTIONS }, (_, sectionIndex) => {
    const questions = buildSectionQuestions(sectionIndex, variant);
    if (questions.length !== QUESTIONS_PER_SECTION) {
      throw new Error(`Listening section ${sectionIndex + 1} question count mismatch`);
    }

    return {
      id: `listening-${variant}-section-${sectionIndex + 1}`,
      title: `Section ${sectionIndex + 1}`,
      audioFileId: null,
      transcript: transcripts[sectionIndex],
      playback: { limitPlays: 1 },
      questions,
    };
  });

  return {
    version: 1,
    timing: { enabled: true, durationMinutes: 30, enforce: true },
    instructions:
      "IELTS Listening computer-delivered format: 4 sections and 40 questions in 30 minutes, followed by short answer-check time (no 10-minute paper transfer sheet).",
    attempts: nullAttempts,
    sections,
  };
}

export function buildListeningConfigOfficialFullComputer(): Prisma.InputJsonObject {
  return buildListeningConfig("full");
}

export function buildListeningConfigOfficialLiteComputer(): Prisma.InputJsonObject {
  return buildListeningConfig("lite");
}
