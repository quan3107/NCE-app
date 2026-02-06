/**
 * File: src/prisma/seeds/ieltsOfficialFixtures.ts
 * Purpose: Export official IELTS fixture builders and title-based seed mappings.
 * Why: Lets all seed scripts share one deterministic source of assignmentConfig payloads.
 */
import { AssignmentType, type Prisma } from "../generated.js";
import {
  buildListeningConfigOfficialFullComputer,
  buildListeningConfigOfficialLiteComputer,
} from "./ieltsOfficialListening.js";
import {
  buildReadingConfigOfficialFull,
  buildReadingConfigOfficialLite,
} from "./ieltsOfficialReading.js";
import { buildSpeakingConfigOfficial } from "./ieltsOfficialSpeaking.js";
import {
  buildWritingAcademicConfigOfficial,
  buildWritingGeneralConfigOfficial,
} from "./ieltsOfficialWriting.js";

export {
  buildReadingConfigOfficialFull,
  buildReadingConfigOfficialLite,
  buildListeningConfigOfficialFullComputer,
  buildListeningConfigOfficialLiteComputer,
  buildWritingAcademicConfigOfficial,
  buildWritingGeneralConfigOfficial,
  buildSpeakingConfigOfficial,
};

type WritingTrack = "academic" | "general";
type SeedDescriptor = {
  type: AssignmentType;
  variant: "full" | "lite";
  writingTrack?: WritingTrack;
};

function buildFromDescriptor(descriptor: SeedDescriptor): Prisma.InputJsonObject {
  if (descriptor.type === AssignmentType.reading) {
    return descriptor.variant === "full"
      ? buildReadingConfigOfficialFull()
      : buildReadingConfigOfficialLite();
  }
  if (descriptor.type === AssignmentType.listening) {
    return descriptor.variant === "full"
      ? buildListeningConfigOfficialFullComputer()
      : buildListeningConfigOfficialLiteComputer();
  }
  if (descriptor.type === AssignmentType.writing) {
    if (descriptor.writingTrack === "general") {
      return buildWritingGeneralConfigOfficial(descriptor.variant);
    }
    return buildWritingAcademicConfigOfficial(descriptor.variant);
  }
  return buildSpeakingConfigOfficial(descriptor.variant);
}

export const PRIMARY_IELTS_ASSIGNMENT_SEED_MAP: Record<string, SeedDescriptor> = {
  "Academic Essay: Technology and Society": {
    type: AssignmentType.writing,
    variant: "full",
    writingTrack: "academic",
  },
  "Data Interpretation Task 1: Global Energy Mix": {
    type: AssignmentType.writing,
    variant: "lite",
    writingTrack: "academic",
  },
  "Part 2 Cue Card: Memorable Journey": {
    type: AssignmentType.speaking,
    variant: "full",
  },
  "Part 3 Discussion: Urban Living": {
    type: AssignmentType.speaking,
    variant: "lite",
  },
  "Section 3 University Projects": {
    type: AssignmentType.listening,
    variant: "lite",
  },
  "Gap Fill Drill: Renewable Energy Lecture": {
    type: AssignmentType.listening,
    variant: "lite",
  },
  "True/False/Not Given Drill": {
    type: AssignmentType.reading,
    variant: "full",
  },
  "Matching Headings Practice": {
    type: AssignmentType.reading,
    variant: "lite",
  },
  "General Training Letter: Workplace Equipment": {
    type: AssignmentType.writing,
    variant: "full",
    writingTrack: "general",
  },
  "Listening Mock Test: Band 7 Target": {
    type: AssignmentType.listening,
    variant: "full",
  },
};

export const SANDBOX_IELTS_ASSIGNMENT_SEED_MAP: Record<string, SeedDescriptor> = {
  "Reading A1: Multiple Choice + True/False/Not Given": {
    type: AssignmentType.reading,
    variant: "full",
  },
  "Reading A2: Matching Headings + Sentence Completion": {
    type: AssignmentType.reading,
    variant: "lite",
  },
  "Listening L1: Sections 1-2 Form Completion": {
    type: AssignmentType.listening,
    variant: "lite",
  },
  "Listening L2: Sections 3-4 MCQ + Short Answer": {
    type: AssignmentType.listening,
    variant: "full",
  },
  "Writing W1: Academic Task 1 + Task 2": {
    type: AssignmentType.writing,
    variant: "full",
    writingTrack: "academic",
  },
  "Writing W2: General Training Task 1 + Task 2": {
    type: AssignmentType.writing,
    variant: "lite",
    writingTrack: "general",
  },
  "Speaking S1: Part 1 + Part 2 Cue Card + Part 3": {
    type: AssignmentType.speaking,
    variant: "full",
  },
  "Speaking S2: Fluency and Coherence Drill": {
    type: AssignmentType.speaking,
    variant: "lite",
  },
};

export function buildPrimaryIeltsAssignmentConfig(
  title: string,
  type: AssignmentType,
): Prisma.InputJsonObject {
  const descriptor = PRIMARY_IELTS_ASSIGNMENT_SEED_MAP[title];
  if (!descriptor) {
    throw new Error(`Missing primary IELTS seed descriptor for ${title}`);
  }
  if (descriptor.type !== type) {
    throw new Error(`Primary IELTS seed type mismatch for ${title}`);
  }
  return buildFromDescriptor(descriptor);
}

export function buildSandboxIeltsAssignmentConfig(
  title: string,
  type: AssignmentType,
): Prisma.InputJsonObject {
  const descriptor = SANDBOX_IELTS_ASSIGNMENT_SEED_MAP[title];
  if (!descriptor) {
    throw new Error(`Missing sandbox IELTS seed descriptor for ${title}`);
  }
  if (descriptor.type !== type) {
    throw new Error(`Sandbox IELTS seed type mismatch for ${title}`);
  }
  return buildFromDescriptor(descriptor);
}
