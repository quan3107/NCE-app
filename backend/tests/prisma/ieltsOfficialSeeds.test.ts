/**
 * File: tests/prisma/ieltsOfficialSeeds.test.ts
 * Purpose: Validate official IELTS seed fixtures and title mappings used by seed scripts.
 * Why: Guards official structure invariants and scoring compatibility for seeded assignments.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { AssignmentType } from '../../src/prisma/generated/client/client.js';
import {
  buildListeningConfigOfficialFullComputer,
  buildListeningConfigOfficialLiteComputer,
  buildPrimaryIeltsAssignmentConfig,
  buildReadingConfigOfficialFull,
  buildReadingConfigOfficialLite,
  buildSandboxIeltsAssignmentConfig,
  buildSpeakingConfigOfficial,
  buildWritingAcademicConfigOfficial,
  buildWritingGeneralConfigOfficial,
  PRIMARY_IELTS_ASSIGNMENT_SEED_MAP,
  SANDBOX_IELTS_ASSIGNMENT_SEED_MAP,
} from '../../src/prisma/seeds/ieltsOfficialFixtures.js';
import { scoreIeltsSubmission } from '../../src/modules/scoring/ieltsScoring.utils.js';
import {
  assertOfficialListeningConfig,
  assertOfficialReadingConfig,
  assertOfficialSpeakingConfig,
  assertOfficialWritingConfig,
} from './ieltsSeedShapeAssertions.js';

const testDir = dirname(fileURLToPath(import.meta.url));
const backendRoot = resolve(testDir, '../..');

function extractAssignmentTitles(relativePath: string): string[] {
  const source = readFileSync(resolve(backendRoot, relativePath), 'utf8');
  const start = source.indexOf('const assignmentSeeds');
  expect(start).toBeGreaterThan(-1);

  const end = source.indexOf('];', start);
  expect(end).toBeGreaterThan(start);

  const block = source.slice(start, end);
  const matches = [...block.matchAll(/title:\s*["']([^"']+)["']/g)].map(
    (match) => match[1],
  );
  return matches;
}

function buildSubmittedAnswers(config: unknown): Array<{ questionId: string; value: unknown }> {
  if (!config || typeof config !== 'object') {
    return [];
  }

  const sections = Array.isArray((config as Record<string, unknown>).sections)
    ? ((config as Record<string, unknown>).sections as Array<Record<string, unknown>>)
    : [];

  return sections.flatMap((section) => {
    const questions = Array.isArray(section.questions)
      ? (section.questions as Array<Record<string, unknown>>)
      : [];
    return questions
      .filter(
        (question) =>
          typeof question.id === 'string' && typeof question.answer === 'string',
      )
      .map((question) => ({ questionId: question.id as string, value: question.answer }));
  });
}

describe('official IELTS fixtures', () => {
  it('keeps reading configs at 3 passages and 40 questions', () => {
    assertOfficialReadingConfig(buildReadingConfigOfficialFull());
    assertOfficialReadingConfig(buildReadingConfigOfficialLite());
  });

  it('keeps listening configs at 4 sections and 40 questions', () => {
    assertOfficialListeningConfig(buildListeningConfigOfficialFullComputer());
    assertOfficialListeningConfig(buildListeningConfigOfficialLiteComputer());
  });

  it('keeps writing configs at 2 tasks with 150/250 instructions', () => {
    assertOfficialWritingConfig(buildWritingAcademicConfigOfficial('full'));
    assertOfficialWritingConfig(buildWritingAcademicConfigOfficial('lite'));
    assertOfficialWritingConfig(buildWritingGeneralConfigOfficial('full'));
    assertOfficialWritingConfig(buildWritingGeneralConfigOfficial('lite'));
  });

  it('keeps speaking configs at 3 parts with 60/120 part 2 timing', () => {
    assertOfficialSpeakingConfig(buildSpeakingConfigOfficial('full'));
    assertOfficialSpeakingConfig(buildSpeakingConfigOfficial('lite'));
  });
});

describe('seed title mappings', () => {
  it('builds valid configs for every primary seed title mapping', () => {
    Object.entries(PRIMARY_IELTS_ASSIGNMENT_SEED_MAP).forEach(([title, descriptor]) => {
      const config = buildPrimaryIeltsAssignmentConfig(title, descriptor.type);
      if (descriptor.type === AssignmentType.reading) {
        assertOfficialReadingConfig(config);
      } else if (descriptor.type === AssignmentType.listening) {
        assertOfficialListeningConfig(config);
      } else if (descriptor.type === AssignmentType.writing) {
        assertOfficialWritingConfig(config);
      } else {
        assertOfficialSpeakingConfig(config);
      }
    });
  });

  it('builds valid configs for every sandbox seed title mapping', () => {
    Object.entries(SANDBOX_IELTS_ASSIGNMENT_SEED_MAP).forEach(([title, descriptor]) => {
      const config = buildSandboxIeltsAssignmentConfig(title, descriptor.type);
      if (descriptor.type === AssignmentType.reading) {
        assertOfficialReadingConfig(config);
      } else if (descriptor.type === AssignmentType.listening) {
        assertOfficialListeningConfig(config);
      } else if (descriptor.type === AssignmentType.writing) {
        assertOfficialWritingConfig(config);
      } else {
        assertOfficialSpeakingConfig(config);
      }
    });
  });

  it('keeps seed.ts and seedIeltsAssignments.ts title sets in parity', () => {
    const seedTitles = extractAssignmentTitles('src/prisma/seed.ts').sort();
    const ieltsSeedTitles = extractAssignmentTitles('src/prisma/seedIeltsAssignments.ts').sort();
    expect(seedTitles).toEqual(ieltsSeedTitles);
    expect(seedTitles.length).toBe(10);
  });
});

describe('auto-scoring compatibility', () => {
  it('keeps reading/listening fixture question totals compatible with scoring', () => {
    const readingConfig = buildReadingConfigOfficialFull();
    const listeningConfig = buildListeningConfigOfficialFullComputer();

    const readingScore = scoreIeltsSubmission({
      assignmentType: AssignmentType.reading,
      assignmentConfig: readingConfig,
      submissionPayload: { answers: buildSubmittedAnswers(readingConfig) },
    });

    const listeningScore = scoreIeltsSubmission({
      assignmentType: AssignmentType.listening,
      assignmentConfig: listeningConfig,
      submissionPayload: { answers: buildSubmittedAnswers(listeningConfig) },
    });

    expect(readingScore).toMatchObject({ totalCount: 40, correctCount: 40 });
    expect(listeningScore).toMatchObject({ totalCount: 40, correctCount: 40 });
  });
});
