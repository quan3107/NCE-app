/**
 * File: tests/modules/ai-feedback/ai-feedback.objective-eligibility.test.ts
 * Purpose: Verify seeded and legacy objective explanation eligibility.
 * Why: Only schema-valid, source-backed submissions may queue explanations.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AssignmentType, UserRole, UserStatus } from '../../../src/prisma/index.js'
import { buildPrimaryIeltsAssignmentConfig } from '../../../src/prisma/seeds/ieltsOfficialFixtures.js'
import { buildIeltsObjectiveSubmissionPayload } from '../../../src/prisma/seeds/ieltsOfficialSubmissions.js'

vi.mock('../../../src/prisma/client.js', () => ({
  prisma: {
    auditLog: { create: vi.fn() },
    submission: { findFirst: vi.fn() },
  },
}))

vi.mock('../../../src/modules/ai-feedback/ai-feedback.repository.js', () => ({
  createAiFeedbackDraft: vi.fn(),
  findAiObjectiveExplanationByCacheKey: vi.fn(),
  findLatestAiFeedbackDraftBySubmission: vi.fn(),
  supersedeAiFeedbackDrafts: vi.fn(),
  upsertAiObjectiveExplanation: vi.fn(),
}))

const prismaModule = await import('../../../src/prisma/client.js')
const repositoryModule =
  await import('../../../src/modules/ai-feedback/ai-feedback.repository.js')
const configModule =
  await import('../../../src/modules/ai-feedback/ai-feedback.config.js')
const { requestAiObjectiveExplanation } =
  await import('../../../src/modules/ai-feedback/ai-feedback.service.js')

const prisma = vi.mocked(prismaModule.prisma, true)
const upsertAiObjectiveExplanation = vi.mocked(
  repositoryModule.upsertAiObjectiveExplanation,
)
const submissionId = '11111111-1111-4111-8111-111111111111'
const assignmentId = '22222222-2222-4222-8222-222222222222'
const studentId = '33333333-3333-4333-8333-333333333333'
const studentActor = {
  id: studentId,
  role: UserRole.student,
  status: UserStatus.active,
}

function seededSubmission(payload: unknown, assignmentConfig: unknown) {
  return {
    id: submissionId,
    assignmentId,
    studentId,
    payload,
    grade: { rawScore: 40, finalScore: 9, band: 9, deletedAt: null },
    assignment: {
      id: assignmentId,
      title: 'Matching Headings Practice',
      type: AssignmentType.reading,
      assignmentConfig,
      course: { ownerId: '44444444-4444-4444-8444-444444444444', enrollments: [] },
    },
  }
}

describe('objective explanation payload eligibility', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    configModule.aiFeedbackConfig.enabled = true
    configModule.aiFeedbackConfig.apiKey = 'test-key'
    configModule.aiFeedbackConfig.baseUrl = 'https://example.com/v1'
    upsertAiObjectiveExplanation.mockResolvedValue({
      id: '55555555-5555-4555-8555-555555555555',
      status: 'queued',
      generatedExplanation: null,
    } as never)
  })

  it('queues source-backed evidence from the seeded Matching Headings payload', async () => {
    const assignmentConfig = buildPrimaryIeltsAssignmentConfig(
      'Matching Headings Practice',
      AssignmentType.reading,
    )
    assignmentConfig.aiPolicy = {
      writingFeedbackMode: 'off',
      objectiveExplanations: 'on_demand_student_visible',
      providerTier: 'auto',
    }
    const payload = buildIeltsObjectiveSubmissionPayload(
      'Matching Headings Practice',
      assignmentConfig,
    )
    prisma.submission.findFirst.mockResolvedValueOnce(
      seededSubmission(payload, assignmentConfig) as never,
    )

    await expect(
      requestAiObjectiveExplanation(
        { submissionId, questionId: 'reading-lite-p1-q6' },
        studentActor,
      ),
    ).resolves.toMatchObject({ status: 'queued', cached: false })
    expect(upsertAiObjectiveExplanation).toHaveBeenCalledWith(
      expect.objectContaining({
        submissionId,
        assignmentId,
        questionId: 'reading-lite-p1-q6',
        deterministicResult: 'correct',
        status: 'queued',
      }),
    )
  })

  it.each(['reading-lite-p1-q1', 'reading-lite-p1-q2'])(
    'queues the first seeded Matching Headings explanation for %s',
    async (questionId) => {
      const assignmentConfig = buildPrimaryIeltsAssignmentConfig(
        'Matching Headings Practice',
        AssignmentType.reading,
      )
      assignmentConfig.aiPolicy = {
        writingFeedbackMode: 'off',
        objectiveExplanations: 'on_demand_student_visible',
        providerTier: 'auto',
      }
      const payload = buildIeltsObjectiveSubmissionPayload(
        'Matching Headings Practice',
        assignmentConfig,
      )
      prisma.submission.findFirst.mockResolvedValueOnce(
        seededSubmission(payload, assignmentConfig) as never,
      )

      await expect(
        requestAiObjectiveExplanation({ submissionId, questionId }, studentActor),
      ).resolves.toMatchObject({ status: 'queued', cached: false })
      expect(upsertAiObjectiveExplanation).toHaveBeenCalledWith(
        expect.objectContaining({
          submissionId,
          assignmentId,
          questionId,
          deterministicResult: 'correct',
          status: 'queued',
        }),
      )
    },
  )

  it('rejects malformed legacy payloads before queueing or auditing', async () => {
    const assignmentConfig = buildPrimaryIeltsAssignmentConfig(
      'Matching Headings Practice',
      AssignmentType.reading,
    )
    assignmentConfig.aiPolicy = {
      writingFeedbackMode: 'off',
      objectiveExplanations: 'on_demand_student_visible',
      providerTier: 'auto',
    }
    prisma.submission.findFirst.mockResolvedValueOnce(
      seededSubmission(
        { version: 1, files: [{ id: 'legacy-file', name: 'answers.pdf' }] },
        assignmentConfig,
      ) as never,
    )

    await expect(
      requestAiObjectiveExplanation(
        { submissionId, questionId: 'reading-lite-p1-q6' },
        studentActor,
      ),
    ).rejects.toMatchObject({
      statusCode: 409,
      message:
        'Objective explanations are unavailable because this submission has no structured answers.',
    })
    expect(upsertAiObjectiveExplanation).not.toHaveBeenCalled()
    expect(prisma.auditLog.create).not.toHaveBeenCalled()
  })
})
