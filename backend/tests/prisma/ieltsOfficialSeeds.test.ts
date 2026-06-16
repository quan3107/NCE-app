/**
 * File: tests/prisma/ieltsOfficialSeeds.test.ts
 * Purpose: Validate official IELTS seed fixtures and title mappings used by seed scripts.
 * Why: Guards official structure invariants and scoring compatibility for seeded assignments.
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { AssignmentType } from '../../src/prisma/index.js'
import { parseSubmissionPayloadForType } from '../../src/modules/assignments/ielts.schema.js'
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
} from '../../src/prisma/seeds/ieltsOfficialFixtures.js'
import {
  PRIMARY_IELTS_WRITING_SUBMISSION_SEED_MAP,
  buildIeltsWritingSubmissionPayload,
} from '../../src/prisma/seeds/ieltsOfficialSubmissions.js'
import {
  getIeltsQuestionScoringEvidence,
  scoreIeltsSubmission,
} from '../../src/modules/scoring/ieltsScoring.utils.js'
import {
  assertOfficialListeningConfig,
  assertOfficialReadingConfig,
  assertOfficialSpeakingConfig,
  assertOfficialWritingConfig,
} from './ieltsSeedShapeAssertions.js'

const testDir = dirname(fileURLToPath(import.meta.url))
const backendRoot = resolve(testDir, '../..')

function extractConstBlock(relativePath: string, constName: string): string {
  const source = readFileSync(resolve(backendRoot, relativePath), 'utf8')
  const start = source.indexOf(`const ${constName}`)
  expect(start).toBeGreaterThan(-1)

  const arrayStart = source.indexOf('[', start)
  expect(arrayStart).toBeGreaterThan(start)

  let depth = 0
  let arrayEnd = -1
  for (let index = arrayStart; index < source.length; index += 1) {
    const character = source[index]
    if (character === '[') {
      depth += 1
    } else if (character === ']') {
      depth -= 1
      if (depth === 0) {
        arrayEnd = index + 1
        break
      }
    }
  }
  expect(arrayEnd).toBeGreaterThan(arrayStart)

  return source.slice(start, arrayEnd)
}

function extractObjectWithField(block: string, field: string, value: string): string {
  const marker = `${field}: '${value}'`
  const markerIndex = block.indexOf(marker)
  expect(markerIndex).toBeGreaterThan(-1)

  const objectStart = block.lastIndexOf('{', markerIndex)
  expect(objectStart).toBeGreaterThan(-1)

  let depth = 0
  let objectEnd = -1
  for (let index = objectStart; index < block.length; index += 1) {
    const character = block[index]
    if (character === '{') {
      depth += 1
    } else if (character === '}') {
      depth -= 1
      if (depth === 0) {
        objectEnd = index + 1
        break
      }
    }
  }
  expect(objectEnd).toBeGreaterThan(objectStart)

  return block.slice(objectStart, objectEnd)
}

function extractTitlesFromConstBlock(relativePath: string, constName: string): string[] {
  const block = extractConstBlock(relativePath, constName)
  const matches = [...block.matchAll(/title:\s*["']([^"']+)["']/g)].map(
    (match) => match[1],
  )
  const assignmentTitleMatches = [
    ...block.matchAll(/assignmentTitle:\s*["']([^"']+)["']/g),
  ].map((match) => match[1])
  return [...matches, ...assignmentTitleMatches]
}

function extractAssignmentTitles(relativePath: string): string[] {
  const matches = extractTitlesFromConstBlock(relativePath, 'assignmentSeeds')
  return matches
}

function buildSubmittedAnswers(
  config: unknown,
): Array<{ questionId: string; value: unknown }> {
  if (!config || typeof config !== 'object') {
    return []
  }

  const sections = Array.isArray((config as Record<string, unknown>).sections)
    ? ((config as Record<string, unknown>).sections as Array<Record<string, unknown>>)
    : []

  return sections.flatMap((section) => {
    const questions = Array.isArray(section.questions)
      ? (section.questions as Array<Record<string, unknown>>)
      : []
    return questions
      .filter(
        (question) =>
          typeof question.id === 'string' && typeof question.answer === 'string',
      )
      .map((question) => ({ questionId: question.id as string, value: question.answer }))
  })
}

describe('official IELTS fixtures', () => {
  it('keeps reading configs at 3 passages and 40 questions', () => {
    assertOfficialReadingConfig(buildReadingConfigOfficialFull())
    assertOfficialReadingConfig(buildReadingConfigOfficialLite())
  })

  it('keeps listening configs at 4 sections and 40 questions', () => {
    assertOfficialListeningConfig(buildListeningConfigOfficialFullComputer())
    assertOfficialListeningConfig(buildListeningConfigOfficialLiteComputer())
  })

  it('keeps writing configs at 2 tasks with 150/250 instructions', () => {
    assertOfficialWritingConfig(buildWritingAcademicConfigOfficial('full'))
    assertOfficialWritingConfig(buildWritingAcademicConfigOfficial('lite'))
    assertOfficialWritingConfig(buildWritingGeneralConfigOfficial('full'))
    assertOfficialWritingConfig(buildWritingGeneralConfigOfficial('lite'))
  })

  it('keeps speaking configs at 3 parts with 60/120 part 2 timing', () => {
    assertOfficialSpeakingConfig(buildSpeakingConfigOfficial('full'))
    assertOfficialSpeakingConfig(buildSpeakingConfigOfficial('lite'))
  })
})

describe('seed title mappings', () => {
  it('builds valid configs for every primary seed title mapping', () => {
    Object.entries(PRIMARY_IELTS_ASSIGNMENT_SEED_MAP).forEach(([title, descriptor]) => {
      const config = buildPrimaryIeltsAssignmentConfig(title, descriptor.type)
      if (descriptor.type === AssignmentType.reading) {
        assertOfficialReadingConfig(config)
      } else if (descriptor.type === AssignmentType.listening) {
        assertOfficialListeningConfig(config)
      } else if (descriptor.type === AssignmentType.writing) {
        assertOfficialWritingConfig(config)
      } else {
        assertOfficialSpeakingConfig(config)
      }
    })
  })

  it('builds valid configs for every sandbox seed title mapping', () => {
    Object.entries(SANDBOX_IELTS_ASSIGNMENT_SEED_MAP).forEach(([title, descriptor]) => {
      const config = buildSandboxIeltsAssignmentConfig(title, descriptor.type)
      if (descriptor.type === AssignmentType.reading) {
        assertOfficialReadingConfig(config)
      } else if (descriptor.type === AssignmentType.listening) {
        assertOfficialListeningConfig(config)
      } else if (descriptor.type === AssignmentType.writing) {
        assertOfficialWritingConfig(config)
      } else {
        assertOfficialSpeakingConfig(config)
      }
    })
  })

  it('keeps seed.ts and seedIeltsAssignments.ts title sets in parity', () => {
    const seedTitles = extractAssignmentTitles('src/prisma/seed.ts').sort()
    const ieltsSeedTitles = extractAssignmentTitles(
      'src/prisma/seedIeltsAssignments.ts',
    ).sort()
    expect(seedTitles).toEqual(ieltsSeedTitles)
    expect(seedTitles.length).toBe(10)
  })
})

describe('seeded writing submission payloads', () => {
  it('keeps the General Training workplace equipment prompt aligned with its seeded response', () => {
    const assignmentConfig = buildPrimaryIeltsAssignmentConfig(
      'General Training Letter: Workplace Equipment',
      AssignmentType.writing,
    )
    const payload = buildIeltsWritingSubmissionPayload(
      'General Training Letter: Workplace Equipment',
    )

    expect(assignmentConfig.task1.prompt.toLowerCase()).toContain('equipment')
    expect(payload.task1.text.toLowerCase()).toContain('equipment')
  })

  it('covers every primary writing assignment with current IELTS writing payloads', () => {
    const writingTitles = Object.entries(PRIMARY_IELTS_ASSIGNMENT_SEED_MAP)
      .filter(([, descriptor]) => descriptor.type === AssignmentType.writing)
      .map(([title]) => title)
      .sort()

    expect(Object.keys(PRIMARY_IELTS_WRITING_SUBMISSION_SEED_MAP).sort()).toEqual(
      writingTitles,
    )

    writingTitles.forEach((title) => {
      const payload = buildIeltsWritingSubmissionPayload(title)
      const parsed = parseSubmissionPayloadForType(AssignmentType.writing, payload)

      expect(parsed.task1.text.trim().length).toBeGreaterThan(0)
      expect(parsed.task2.text.trim().length).toBeGreaterThan(0)
    })
  })

  it('keeps file-submission examples off primary IELTS writing assignments', () => {
    const writingTitles = Object.entries(PRIMARY_IELTS_ASSIGNMENT_SEED_MAP)
      .filter(([, descriptor]) => descriptor.type === AssignmentType.writing)
      .map(([title]) => title)
    const fileSubmissionTitles = extractTitlesFromConstBlock(
      'src/prisma/seed.ts',
      'fileSubmissionSeeds',
    )

    expect(fileSubmissionTitles.filter((title) => writingTitles.includes(title))).toEqual(
      [],
    )
  })

  it('keeps the Matching Headings file-submission fixture reading-specific', () => {
    const fileSeedsBlock = extractConstBlock('src/prisma/seed.ts', 'fileSeeds')
    const fileSubmissionSeedsBlock = extractConstBlock(
      'src/prisma/seed.ts',
      'fileSubmissionSeeds',
    )
    const readingFileEntry = extractObjectWithField(
      fileSeedsBlock,
      'key',
      'reading/matching-headings/amelia.pdf',
    )
    const matchingHeadingsEntry = extractObjectWithField(
      fileSubmissionSeedsBlock,
      'assignmentTitle',
      'Matching Headings Practice',
    )

    expect(readingFileEntry).toContain("ownerEmail: 'amelia.chan@ielts.local'")
    expect(matchingHeadingsEntry).toContain(
      "fileKey: 'reading/matching-headings/amelia.pdf'",
    )
    expect(matchingHeadingsEntry.toLowerCase()).toContain('heading')
    expect(matchingHeadingsEntry.toLowerCase()).not.toContain('comparison')
    expect(matchingHeadingsEntry.toLowerCase()).not.toContain('conclusion')
  })
})

describe('auto-scoring compatibility', () => {
  it('keeps reading/listening fixture question totals compatible with scoring', () => {
    const readingConfig = buildReadingConfigOfficialFull()
    const listeningConfig = buildListeningConfigOfficialFullComputer()

    const readingScore = scoreIeltsSubmission({
      assignmentType: AssignmentType.reading,
      assignmentConfig: readingConfig,
      submissionPayload: { answers: buildSubmittedAnswers(readingConfig) },
    })

    const listeningScore = scoreIeltsSubmission({
      assignmentType: AssignmentType.listening,
      assignmentConfig: listeningConfig,
      submissionPayload: { answers: buildSubmittedAnswers(listeningConfig) },
    })

    expect(readingScore).toMatchObject({ totalCount: 40, correctCount: 40 })
    expect(listeningScore).toMatchObject({ totalCount: 40, correctCount: 40 })
  })

  it('keeps at least one seeded listening explanation source-backed', () => {
    const listeningConfig = buildListeningConfigOfficialFullComputer()
    const evidence = getIeltsQuestionScoringEvidence({
      assignmentType: AssignmentType.listening,
      assignmentConfig: listeningConfig,
      submissionPayload: {
        answers: [{ questionId: 'listening-full-s1-q1', value: '3 September' }],
      },
      questionId: 'listening-full-s1-q1',
    })

    expect(evidence).toMatchObject({
      questionId: 'listening-full-s1-q1',
      acceptedAnswer: '3 September',
      sourceEvidenceStatus: 'available',
    })
    expect(evidence?.sourceEvidenceCandidates[0]?.quote).toContain('3 September')
  })
})
