/**
 * File: tests/modules/ai-feedback/ai-feedback.writing-feedback.service.test.ts
 * Purpose: Verify IELTS writing AI feedback request orchestration.
 * Why: Writing feedback must respect course access, assignment policy, visibility, and image context.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AssignmentType,
  EnrollmentRole,
  UserRole,
  UserStatus,
} from '../../../src/prisma/index.js'
import { buildPrimaryIeltsAssignmentConfig } from '../../../src/prisma/seeds/ieltsOfficialFixtures.js'
import { buildIeltsWritingSubmissionPayload } from '../../../src/prisma/seeds/ieltsOfficialSubmissions.js'

vi.mock('../../../src/prisma/client.js', () => ({
  prisma: {
    assignment: {
      findFirst: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    rubric: {
      findMany: vi.fn(),
    },
    submission: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
  },
}))

vi.mock('../../../src/modules/ai-feedback/image-context.js', () => ({
  resolveAiFeedbackImageContext: vi.fn(),
}))

vi.mock('../../../src/modules/ai-feedback/ai-feedback.repository.js', () => ({
  createAiFeedbackDraft: vi.fn(),
  findActiveAiFeedbackDraftSubmissionIds: vi.fn(),
  findLatestAiFeedbackDraftBySubmission: vi.fn(),
  findAiObjectiveExplanationByCacheKey: vi.fn(),
  supersedeAiFeedbackDrafts: vi.fn(),
  upsertAiObjectiveExplanation: vi.fn(),
}))

const prismaModule = await import('../../../src/prisma/client.js')
const repositoryModule =
  await import('../../../src/modules/ai-feedback/ai-feedback.repository.js')
const imageContextModule =
  await import('../../../src/modules/ai-feedback/image-context.js')
const configModule =
  await import('../../../src/modules/ai-feedback/ai-feedback.config.js')
const {
  requestAssignmentWritingFeedbackBatch,
  enqueueAiWritingFeedbackForSubmission,
  getAiWritingFeedbackStatus,
  regenerateAiWritingFeedback,
  requestAiWritingFeedback,
} = await import('../../../src/modules/ai-feedback/ai-feedback.service.js')

const prisma = vi.mocked(prismaModule.prisma, true)
const createAiFeedbackDraft = vi.mocked(repositoryModule.createAiFeedbackDraft)
const findActiveAiFeedbackDraftSubmissionIds = vi.mocked(
  repositoryModule.findActiveAiFeedbackDraftSubmissionIds,
)
const findLatestAiFeedbackDraftBySubmission = vi.mocked(
  repositoryModule.findLatestAiFeedbackDraftBySubmission,
)
const supersedeAiFeedbackDrafts = vi.mocked(repositoryModule.supersedeAiFeedbackDrafts)
const resolveAiFeedbackImageContext = vi.mocked(
  imageContextModule.resolveAiFeedbackImageContext,
)
const aiFeedbackConfig = configModule.aiFeedbackConfig

const submissionId = '11111111-1111-4111-8111-111111111111'
const assignmentId = '22222222-2222-4222-8222-222222222222'
const courseId = '77777777-7777-4777-8777-777777777777'
const studentId = '33333333-3333-4333-8333-333333333333'
const ownerId = '44444444-4444-4444-8444-444444444444'
const coTeacherId = '55555555-5555-4555-8555-555555555555'
const secondSubmissionId = '12121212-1212-4121-8121-121212121212'
const thirdSubmissionId = '13131313-1313-4131-8131-131313131313'

const teacherActor = {
  id: ownerId,
  role: UserRole.teacher,
  status: UserStatus.active,
}

const studentActor = {
  id: studentId,
  role: UserRole.student,
  status: UserStatus.active,
}

const baseSubmission = {
  id: submissionId,
  assignmentId,
  studentId,
  status: 'submitted',
  payload: {
    version: 1,
    task1: { text: 'The chart shows steady growth.' },
    task2: { text: 'Cities should invest in public transport.' },
  },
  grade: {
    id: '66666666-6666-4666-8666-666666666666',
    rawScore: 6.5,
    finalScore: 6.5,
    band: 6.5,
    feedback: 'Clear position, but examples need depth.',
    deletedAt: null,
  },
  assignment: {
    id: assignmentId,
    title: 'Writing Drill',
    type: AssignmentType.writing,
    courseId,
    assignmentConfig: {
      version: 1,
      instructions: 'Write both IELTS tasks.',
      aiPolicy: {
        writingFeedbackMode: 'teacher_reviewed',
        objectiveExplanations: 'off',
        providerTier: 'auto',
      },
      task1: {
        prompt: 'Summarise the chart.',
        visualType: 'bar_chart',
        imageFileId: '88888888-8888-4888-8888-888888888888',
        rubricId: '99999999-9999-4999-8999-999999999999',
      },
      task2: {
        prompt: 'Discuss both views and give your opinion.',
      },
    },
    course: {
      ownerId,
      enrollments: [],
    },
  },
}

describe('requestAiWritingFeedback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    aiFeedbackConfig.enabled = true
    aiFeedbackConfig.apiKey = 'sk-test'
    aiFeedbackConfig.baseUrl = 'https://example.com/v1'
    aiFeedbackConfig.maxInputChars = 12_000
    prisma.submission.findFirst.mockResolvedValue(baseSubmission as never)
    prisma.rubric.findMany.mockResolvedValue([
      {
        id: '99999999-9999-4999-8999-999999999999',
        name: 'Course writing rubric',
        criteria: [{ name: 'Coherence', levels: [] }],
      },
    ] as never)
    resolveAiFeedbackImageContext.mockResolvedValue({
      type: 'image',
      imageUrl: 'https://storage.mock/task1.png',
      mimeType: 'image/png',
      detail: 'high',
    })
    createAiFeedbackDraft.mockImplementation(async (input: unknown) => {
      const data = input as Record<string, unknown>

      return {
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        submissionId: data.submissionId,
        status: data.status,
        visibilityMode: data.visibilityMode,
        generatedFeedback: data.generatedFeedback,
        failureCode: data.failureCode ?? null,
        failureMessage: data.failureMessage ?? null,
      } as never
    })
  })

  it('queues a hidden teacher-reviewed draft with hosted image context', async () => {
    const response = await requestAiWritingFeedback({ submissionId }, teacherActor)

    expect(createAiFeedbackDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        submissionId,
        assignmentId,
        requesterId: ownerId,
        gradeId: '66666666-6666-4666-8666-666666666666',
        promptVersion: 'ielts-writing-feedback-v1',
        routeKey: 'low_cost',
        provider: 'openai-compatible',
        model: 'gpt-5.4-nano',
        status: 'queued',
        visibilityMode: 'teacher_reviewed',
        inputHash: expect.stringMatching(/^sha256:/),
        generationJob: {
          harnessInput: expect.objectContaining({
            fixtureId: expect.stringContaining(`writing-feedback:${submissionId}:`),
            taskType: 'writing_feedback',
            routeKey: 'low_cost',
            promptInput: expect.objectContaining({
              tasks: expect.objectContaining({
                task1: expect.objectContaining({
                  imageContext: {
                    status: 'image_attached',
                    image: {
                      type: 'image',
                      imageUrl: 'https://storage.mock/task1.png',
                      mimeType: 'image/png',
                      detail: 'high',
                    },
                  },
                }),
              }),
              teacherConstraints: expect.arrayContaining([
                expect.stringContaining('Existing teacher grade'),
                expect.stringContaining('Teacher rubric context'),
              ]),
            }),
          }),
        },
      }),
    )
    expect(supersedeAiFeedbackDrafts).toHaveBeenCalledWith({
      submissionId,
      exceptDraftId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    })
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: ownerId,
        action: 'ai_feedback.writing_requested',
        entity: 'ai_feedback_draft',
        entityId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        diff: expect.objectContaining({
          entityIds: expect.objectContaining({
            submissionId,
            assignmentId,
            gradeId: '66666666-6666-4666-8666-666666666666',
          }),
          routeKey: 'low_cost',
          provider: 'openai-compatible',
          model: 'gpt-5.4-nano',
          promptVersion: 'ielts-writing-feedback-v1',
        }),
      }),
      select: { id: true },
    })
    expect(JSON.stringify(prisma.auditLog.create.mock.calls[0]?.[0])).not.toContain(
      'Cities should invest in public transport.',
    )
    expect(response).toEqual(
      expect.objectContaining({
        status: 'queued',
        visibilityMode: 'teacher_reviewed',
        pollingLocation: `/api/v1/submissions/${submissionId}/ai-feedback/writing`,
      }),
    )
  })

  it('persists instant-visible queued drafts when assignment policy allows it', async () => {
    prisma.submission.findFirst.mockResolvedValueOnce({
      ...baseSubmission,
      assignment: {
        ...baseSubmission.assignment,
        assignmentConfig: {
          ...baseSubmission.assignment.assignmentConfig,
          aiPolicy: {
            writingFeedbackMode: 'instant_student_visible',
            objectiveExplanations: 'off',
            providerTier: 'premium',
          },
        },
      },
    } as never)

    await requestAiWritingFeedback({ submissionId }, teacherActor)

    expect(createAiFeedbackDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        routeKey: 'premium',
        visibilityMode: 'instant_student_visible',
      }),
    )
  })

  it('queues feedback for the seeded General Training writing submission payload', async () => {
    prisma.submission.findFirst.mockResolvedValueOnce({
      ...baseSubmission,
      payload: buildIeltsWritingSubmissionPayload(
        'General Training Letter: Workplace Equipment',
      ),
      assignment: {
        ...baseSubmission.assignment,
        title: 'General Training Letter: Workplace Equipment',
        assignmentConfig: {
          ...buildPrimaryIeltsAssignmentConfig(
            'General Training Letter: Workplace Equipment',
            AssignmentType.writing,
          ),
          aiPolicy: {
            writingFeedbackMode: 'teacher_reviewed',
            objectiveExplanations: 'off',
            providerTier: 'auto',
          },
        },
      },
    } as never)

    await requestAiWritingFeedback({ submissionId }, teacherActor)

    expect(createAiFeedbackDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'queued',
        generationJob: {
          harnessInput: expect.objectContaining({
            promptInput: expect.objectContaining({
              submission: expect.objectContaining({
                task1: expect.objectContaining({
                  text: expect.stringContaining('Dear Facilities Manager'),
                }),
                task2: expect.objectContaining({
                  text: expect.stringContaining('Online public services'),
                }),
              }),
            }),
          }),
        },
      }),
    )
  })

  it('queues feedback after normalizing explicit legacy writing task text', async () => {
    prisma.submission.findFirst.mockResolvedValueOnce({
      ...baseSubmission,
      payload: {
        version: 1,
        responses: {
          task1: 'The chart shows steady growth in commuter rail use.',
          task2: 'Cities should invest in buses and trains before new roads.',
        },
      },
    } as never)

    await requestAiWritingFeedback({ submissionId }, teacherActor)

    expect(createAiFeedbackDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'queued',
        generationJob: {
          harnessInput: expect.objectContaining({
            promptInput: expect.objectContaining({
              submission: {
                task1: {
                  text: 'The chart shows steady growth in commuter rail use.',
                },
                task2: {
                  text: 'Cities should invest in buses and trains before new roads.',
                },
              },
            }),
          }),
        },
      }),
    )
  })

  it('queues feedback after normalizing legacy writing task response fields', async () => {
    prisma.submission.findFirst.mockResolvedValueOnce({
      ...baseSubmission,
      payload: {
        version: 1,
        task1: {
          response: 'The chart shows a steady rise in applications.',
        },
        task2: {
          response: 'Public transport should be funded before new roads.',
        },
      },
    } as never)

    await requestAiWritingFeedback({ submissionId }, teacherActor)

    expect(createAiFeedbackDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'queued',
        generationJob: {
          harnessInput: expect.objectContaining({
            promptInput: expect.objectContaining({
              submission: {
                task1: {
                  text: 'The chart shows a steady rise in applications.',
                },
                task2: {
                  text: 'Public transport should be funded before new roads.',
                },
              },
            }),
          }),
        },
      }),
    )
  })

  it('queues feedback after replacing blank current task text with legacy responses', async () => {
    prisma.submission.findFirst.mockResolvedValueOnce({
      ...baseSubmission,
      payload: {
        version: 1,
        task1: {
          text: '   ',
          response: 'The chart shows actual growth in commuter rail use.',
        },
        task2: {
          text: '',
          response: 'Cities should invest in actual bus and train services.',
        },
      },
    } as never)

    await requestAiWritingFeedback({ submissionId }, teacherActor)

    expect(createAiFeedbackDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'queued',
        generationJob: {
          harnessInput: expect.objectContaining({
            promptInput: expect.objectContaining({
              submission: {
                task1: {
                  text: 'The chart shows actual growth in commuter rail use.',
                },
                task2: {
                  text: 'Cities should invest in actual bus and train services.',
                },
              },
            }),
          }),
        },
      }),
    )
  })

  it('rejects file-only legacy writing payloads with a scoped message', async () => {
    prisma.submission.findFirst.mockResolvedValueOnce({
      ...baseSubmission,
      payload: {
        version: 1,
        artifact: 'Academic Essay: Technology and Society',
        resources: [
          {
            label: 'Primary Submission',
            url: 'https://storage.mock/ielts/submission.pdf',
          },
        ],
      },
    } as never)

    await expect(
      requestAiWritingFeedback({ submissionId }, teacherActor),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: 'Writing submission payload is missing Task 1 and Task 2 text.',
    })

    expect(createAiFeedbackDraft).not.toHaveBeenCalled()
  })

  it('creates a teacher-review-only record when required image context is unavailable', async () => {
    resolveAiFeedbackImageContext.mockRejectedValueOnce(
      new Error('Unsupported image type for AI feedback.'),
    )

    const response = await requestAiWritingFeedback({ submissionId }, teacherActor)

    expect(createAiFeedbackDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'review_required',
        visibilityMode: 'teacher_reviewed',
        failureCode: 'image_context_unavailable',
        failureMessage: 'Unsupported image type for AI feedback.',
      }),
    )
    expect(createAiFeedbackDraft.mock.calls[0]?.[0]).not.toHaveProperty('generationJob')
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: ownerId,
        action: 'ai_feedback.writing_failed',
        entity: 'ai_feedback_draft',
        entityId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        diff: expect.objectContaining({
          payloadSummary: expect.objectContaining({
            failureMessage: expect.objectContaining({ redacted: true }),
          }),
        }),
      }),
      select: { id: true },
    })
    expect(response).toMatchObject({
      status: 'review_required',
      visibilityMode: 'teacher_reviewed',
      failureCode: 'image_context_unavailable',
    })
  })

  it('fails closed when AI feedback generation is globally disabled', async () => {
    aiFeedbackConfig.enabled = false

    await expect(
      requestAiWritingFeedback({ submissionId }, teacherActor),
    ).rejects.toMatchObject({
      statusCode: 503,
      message: 'AI feedback generation is disabled.',
    })

    expect(createAiFeedbackDraft).not.toHaveBeenCalled()
  })

  it('rejects cross-course teacher access before creating a draft', async () => {
    prisma.submission.findFirst.mockResolvedValueOnce({
      ...baseSubmission,
      assignment: {
        ...baseSubmission.assignment,
        course: {
          ownerId,
          enrollments: [],
        },
      },
    } as never)

    await expect(
      requestAiWritingFeedback(
        { submissionId },
        {
          id: coTeacherId,
          role: UserRole.teacher,
          status: UserStatus.active,
        },
      ),
    ).rejects.toMatchObject({ statusCode: 403 })

    expect(createAiFeedbackDraft).not.toHaveBeenCalled()
  })
})

describe('requestAssignmentWritingFeedbackBatch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    aiFeedbackConfig.enabled = true
    aiFeedbackConfig.apiKey = 'sk-test'
    aiFeedbackConfig.baseUrl = 'https://example.com/v1'
    prisma.assignment.findFirst.mockResolvedValue({
      id: assignmentId,
      courseId,
      course: {
        ownerId,
        enrollments: [],
      },
    } as never)
    prisma.submission.findMany.mockResolvedValue([
      {
        id: submissionId,
      },
      {
        id: secondSubmissionId,
      },
      {
        id: thirdSubmissionId,
      },
    ] as never)
    findActiveAiFeedbackDraftSubmissionIds.mockResolvedValue(
      new Set([secondSubmissionId]),
    )
    prisma.submission.findFirst.mockImplementation(async ({ where }: never) => {
      const requestedSubmissionId = (where as { id: string }).id

      if (requestedSubmissionId === thirdSubmissionId) {
        return {
          ...baseSubmission,
          id: thirdSubmissionId,
          assignment: {
            ...baseSubmission.assignment,
            course: {
              ownerId,
              enrollments: [],
            },
          },
        } as never
      }

      return {
        ...baseSubmission,
        id: submissionId,
        assignment: {
          ...baseSubmission.assignment,
          course: {
            ownerId,
            enrollments: [],
          },
        },
      } as never
    })
    prisma.rubric.findMany.mockResolvedValue([] as never)
    resolveAiFeedbackImageContext.mockResolvedValue({
      type: 'image',
      imageUrl: 'https://storage.mock/task1.png',
      mimeType: 'image/png',
      detail: 'high',
    })
    createAiFeedbackDraft.mockImplementation(async (input: unknown) => {
      const data = input as Record<string, unknown>

      if (data.submissionId === thirdSubmissionId) {
        throw Object.assign(new Error('Queue unavailable'), {
          statusCode: 503,
        })
      }

      return {
        id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        submissionId: data.submissionId,
        status: data.status,
        visibilityMode: data.visibilityMode,
        generatedFeedback: data.generatedFeedback,
        failureCode: null,
        failureMessage: null,
      } as never
    })
  })

  it('queues eligible submissions and reports duplicate or failed batch rows', async () => {
    const response = await requestAssignmentWritingFeedbackBatch(
      { courseId, assignmentId },
      {
        submissionIds: [submissionId, secondSubmissionId, thirdSubmissionId],
      },
      teacherActor,
    )

    expect(prisma.assignment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: assignmentId,
          courseId,
          deletedAt: null,
          course: { deletedAt: null },
        },
      }),
    )
    expect(findActiveAiFeedbackDraftSubmissionIds).toHaveBeenCalledWith([
      submissionId,
      secondSubmissionId,
      thirdSubmissionId,
    ])
    expect(createAiFeedbackDraft).toHaveBeenCalledTimes(2)
    expect(response).toEqual({
      assignmentId,
      requestedCount: 3,
      results: [
        expect.objectContaining({
          submissionId,
          status: 'queued',
          draft: expect.objectContaining({ status: 'queued' }),
        }),
        {
          submissionId: secondSubmissionId,
          status: 'skipped',
          reason: 'AI writing feedback is already queued or running.',
        },
        {
          submissionId: thirdSubmissionId,
          status: 'failed_to_queue',
          reason: 'Queue unavailable',
        },
      ],
    })
  })

  it('resolves submitted/ungraded filters under the authorized assignment', async () => {
    await requestAssignmentWritingFeedbackBatch(
      { courseId, assignmentId },
      { filter: 'ungraded' },
      teacherActor,
    )

    expect(prisma.submission.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          assignmentId,
          status: { in: ['submitted', 'late'] },
          OR: [{ grade: null }, { grade: { deletedAt: { not: null } } }],
        }),
        take: 100,
      }),
    )
  })

  it('caps filter-selected batches before queueing candidates', async () => {
    const candidates = Array.from({ length: 125 }, (_, index) => ({
      id: `${String(index).padStart(8, '0')}-aaaa-4aaa-8aaa-aaaaaaaaaaaa`,
    }))
    prisma.submission.findMany.mockResolvedValueOnce(candidates.slice(0, 100) as never)
    findActiveAiFeedbackDraftSubmissionIds.mockResolvedValueOnce(new Set())

    const response = await requestAssignmentWritingFeedbackBatch(
      { courseId, assignmentId },
      { filter: 'submitted' },
      teacherActor,
    )

    expect(prisma.submission.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 100,
      }),
    )
    expect(findActiveAiFeedbackDraftSubmissionIds).toHaveBeenCalledWith(
      candidates.slice(0, 100).map((candidate) => candidate.id),
    )
    expect(createAiFeedbackDraft).toHaveBeenCalledTimes(100)
    expect(response.requestedCount).toBe(100)
    expect(response.results).toHaveLength(100)
  })

  it('reports assignment policy failures without labeling rows unauthorized', async () => {
    prisma.submission.findMany.mockResolvedValueOnce([{ id: submissionId }] as never)
    findActiveAiFeedbackDraftSubmissionIds.mockResolvedValueOnce(new Set())
    prisma.submission.findFirst.mockResolvedValueOnce({
      ...baseSubmission,
      assignment: {
        ...baseSubmission.assignment,
        assignmentConfig: {
          ...baseSubmission.assignment.assignmentConfig,
          aiPolicy: {
            writingFeedbackMode: 'off',
            objectiveExplanations: 'off',
            providerTier: 'auto',
          },
        },
      },
    } as never)

    const response = await requestAssignmentWritingFeedbackBatch(
      { courseId, assignmentId },
      { filter: 'submitted' },
      teacherActor,
    )

    expect(response.results).toEqual([
      {
        submissionId,
        status: 'policy_disabled',
        reason: 'AI writing feedback is not enabled for this assignment.',
      },
    ])
    expect(createAiFeedbackDraft).not.toHaveBeenCalled()
  })

  it('reports malformed writing payload batch rows with a concise reason', async () => {
    prisma.submission.findMany.mockResolvedValueOnce([{ id: submissionId }] as never)
    findActiveAiFeedbackDraftSubmissionIds.mockResolvedValueOnce(new Set())
    prisma.submission.findFirst.mockResolvedValueOnce({
      ...baseSubmission,
      payload: {
        version: 1,
        files: [
          {
            id: 'file-1',
            name: 'legacy-writing.pdf',
          },
        ],
      },
    } as never)

    const response = await requestAssignmentWritingFeedbackBatch(
      { courseId, assignmentId },
      { filter: 'submitted' },
      teacherActor,
    )

    expect(response.results).toEqual([
      {
        submissionId,
        status: 'failed_to_queue',
        reason: 'Writing submission payload is missing Task 1 and Task 2 text.',
      },
    ])
    expect(createAiFeedbackDraft).not.toHaveBeenCalled()
  })

  it('rejects batch access before listing assignment submissions', async () => {
    prisma.assignment.findFirst.mockResolvedValueOnce({
      id: assignmentId,
      courseId,
      course: {
        ownerId,
        enrollments: [],
      },
    } as never)

    await expect(
      requestAssignmentWritingFeedbackBatch(
        { courseId, assignmentId },
        { filter: 'submitted' },
        {
          id: coTeacherId,
          role: UserRole.teacher,
          status: UserStatus.active,
        },
      ),
    ).rejects.toMatchObject({ statusCode: 403 })

    expect(prisma.submission.findMany).not.toHaveBeenCalled()
  })

  it('requires the nested route course id to match the assignment', async () => {
    prisma.assignment.findFirst.mockResolvedValueOnce(null)

    await expect(
      requestAssignmentWritingFeedbackBatch(
        {
          courseId: 'abababab-abab-4bab-8bab-abababababab',
          assignmentId,
        },
        { filter: 'submitted' },
        teacherActor,
      ),
    ).rejects.toMatchObject({
      statusCode: 404,
      message: 'Assignment not found.',
    })

    expect(prisma.assignment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: assignmentId,
          courseId: 'abababab-abab-4bab-8bab-abababababab',
          deletedAt: null,
          course: { deletedAt: null },
        },
      }),
    )
    expect(prisma.submission.findMany).not.toHaveBeenCalled()
  })
})

describe('enqueueAiWritingFeedbackForSubmission', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    aiFeedbackConfig.enabled = true
    aiFeedbackConfig.apiKey = 'sk-test'
    aiFeedbackConfig.baseUrl = 'https://example.com/v1'
    prisma.submission.findFirst.mockResolvedValue({
      ...baseSubmission,
      assignment: {
        ...baseSubmission.assignment,
        course: {
          ownerId,
          enrollments: [
            {
              userId: coTeacherId,
              roleInCourse: EnrollmentRole.teacher,
              deletedAt: null,
            },
          ],
        },
      },
    } as never)
    prisma.rubric.findMany.mockResolvedValue([] as never)
    resolveAiFeedbackImageContext.mockResolvedValue({
      type: 'image',
      imageUrl: 'https://storage.mock/task1.png',
      mimeType: 'image/png',
      detail: 'high',
    })
    createAiFeedbackDraft.mockResolvedValue({
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      submissionId,
      status: 'queued',
      visibilityMode: 'teacher_reviewed',
      generatedFeedback: { status: 'queued' },
      failureCode: null,
      failureMessage: null,
    } as never)
  })

  it('allows the submitting student to trigger automatic draft generation', async () => {
    await enqueueAiWritingFeedbackForSubmission(submissionId, studentActor)

    expect(createAiFeedbackDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        requesterId: studentId,
        status: 'queued',
      }),
    )
    expect(supersedeAiFeedbackDrafts).toHaveBeenCalledWith({
      submissionId,
      exceptDraftId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    })
  })
})

describe('getAiWritingFeedbackStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    aiFeedbackConfig.enabled = false
    prisma.submission.findFirst.mockResolvedValue(baseSubmission as never)
    findLatestAiFeedbackDraftBySubmission.mockResolvedValue({
      id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      submissionId,
      status: 'running',
      visibilityMode: 'teacher_reviewed',
      generatedFeedback: { status: 'running' },
      failureCode: null,
      failureMessage: null,
    } as never)
  })

  it('returns the latest writing draft status without creating a new draft', async () => {
    const response = await getAiWritingFeedbackStatus({ submissionId }, teacherActor)

    expect(findLatestAiFeedbackDraftBySubmission).toHaveBeenCalledWith(submissionId)
    expect(createAiFeedbackDraft).not.toHaveBeenCalled()
    expect(resolveAiFeedbackImageContext).not.toHaveBeenCalled()
    expect(response).toMatchObject({
      id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      status: 'running',
      visibilityMode: 'teacher_reviewed',
      pollingLocation: `/api/v1/submissions/${submissionId}/ai-feedback/writing`,
    })
  })

  it('returns 404 when no writing draft exists for the submission', async () => {
    findLatestAiFeedbackDraftBySubmission.mockResolvedValueOnce(null)

    await expect(
      getAiWritingFeedbackStatus({ submissionId }, teacherActor),
    ).rejects.toMatchObject({
      statusCode: 404,
      message: 'AI writing feedback draft not found.',
    })
  })
})

describe('regenerateAiWritingFeedback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    aiFeedbackConfig.enabled = true
    aiFeedbackConfig.apiKey = 'sk-test'
    aiFeedbackConfig.baseUrl = 'https://example.com/v1'
    prisma.submission.findFirst.mockResolvedValue(baseSubmission as never)
    prisma.rubric.findMany.mockResolvedValue([] as never)
    resolveAiFeedbackImageContext.mockResolvedValue({
      type: 'image',
      imageUrl: 'https://storage.mock/task1.png',
      mimeType: 'image/png',
      detail: 'high',
    })
    createAiFeedbackDraft.mockImplementation(async (input: unknown) => {
      const data = input as Record<string, unknown>

      return {
        id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        submissionId: data.submissionId,
        status: data.status,
        visibilityMode: data.visibilityMode,
        generatedFeedback: data.generatedFeedback,
        failureCode: null,
        failureMessage: null,
      } as never
    })
  })

  it('queues a new draft using the requested provider tier override', async () => {
    await regenerateAiWritingFeedback(
      { submissionId },
      { providerTier: 'premium' },
      teacherActor,
    )

    expect(createAiFeedbackDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        routeKey: 'premium',
        model: 'gpt-5.4-mini',
        reasoningEffort: 'high',
        generationJob: {
          harnessInput: expect.objectContaining({
            routeKey: 'premium',
          }),
        },
      }),
    )
    expect(supersedeAiFeedbackDrafts).toHaveBeenCalledWith({
      submissionId,
      exceptDraftId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    })
  })
})
