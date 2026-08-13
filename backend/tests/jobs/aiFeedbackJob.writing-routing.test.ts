/**
 * File: tests/jobs/aiFeedbackJob.writing-routing.test.ts
 * Purpose: Verify regeneration preferences and effective route metadata across queue workers.
 * Why: Queued writing drafts must call and record the same fallback-aware Luna route.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  AiConcreteProviderRouteKey,
  AiProvider,
  AiProviderHealthState,
  AiProviderRequest,
  AiProviderResult,
} from '../../src/modules/ai-feedback/provider.types.js'
import {
  sha256,
  stableJson,
} from '../../src/modules/ai-feedback/ai-feedback.writing-feedback.support.js'
import { writingHarnessFixtures } from '../fixtures/ai-feedback/harness/harness.fixtures.js'

vi.mock('../../src/prisma/client.js', () => ({
  prisma: {
    $transaction: vi.fn(),
    aiFeedbackDraft: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}))

vi.mock('../../src/config/logger.js', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
  },
}))

vi.mock('../../src/modules/ai-feedback/ai-feedback.writing-feedback.context.js', () => ({
  loadWritingFeedbackContext: vi.fn(),
  loadWritingFeedbackStatusContext: vi.fn(),
}))

vi.mock('../../src/modules/ai-feedback/ai-feedback.repository.js', () => ({
  createAiFeedbackDraft: vi.fn(),
  findLatestAiFeedbackDraftBySubmission: vi.fn(),
  supersedeAiFeedbackDrafts: vi.fn(),
}))

vi.mock('../../src/modules/audit-logs/ai-feedback-audit.js', () => ({
  AI_FEEDBACK_AUDIT_ACTIONS: {
    writingRequested: 'ai_feedback.writing_requested',
    writingGenerated: 'ai_feedback.writing_generated',
    writingFailed: 'ai_feedback.writing_failed',
  },
  recordAiFeedbackAudit: vi.fn(),
}))

const prismaModule = await import('../../src/prisma/client.js')
const contextModule =
  await import('../../src/modules/ai-feedback/ai-feedback.writing-feedback.context.js')
const repositoryModule =
  await import('../../src/modules/ai-feedback/ai-feedback.repository.js')
const configModule = await import('../../src/modules/ai-feedback/ai-feedback.config.js')
const { regenerateAiWritingFeedback } =
  await import('../../src/modules/ai-feedback/ai-feedback.writing-feedback.js')
const { processWritingDraftJob } =
  await import('../../src/jobs/aiFeedbackJob.processing.js')
const { createAiProviderRouter } =
  await import('../../src/modules/ai-feedback/provider.router.js')

const prisma = vi.mocked(prismaModule.prisma, true)
const loadWritingFeedbackContext = vi.mocked(contextModule.loadWritingFeedbackContext)
const createAiFeedbackDraft = vi.mocked(repositoryModule.createAiFeedbackDraft)
const aiFeedbackConfig = configModule.aiFeedbackConfig
const validWritingFixture = writingHarnessFixtures[0]

type ProviderTier = 'auto' | AiConcreteProviderRouteKey
type QueuedHarnessInput = {
  fixtureId: string
  taskType: 'writing_feedback'
  promptInput: typeof validWritingFixture.promptInput
  routeKey: AiConcreteProviderRouteKey
}
type QueuedDraftInput = {
  inputHash: string
  routeKey: AiConcreteProviderRouteKey
  model: string
  reasoningEffort: string
  generationJob: { harnessInput: QueuedHarnessInput }
}

function promptInputWithTier(providerTier: ProviderTier) {
  return {
    ...validWritingFixture.promptInput,
    assignment: {
      ...validWritingFixture.promptInput.assignment,
      config: {
        ...validWritingFixture.promptInput.assignment.config,
        aiPolicy: {
          ...validWritingFixture.promptInput.assignment.config.aiPolicy,
          providerTier,
        },
      },
    },
  }
}

function provider(routeKey: AiConcreteProviderRouteKey): AiProvider {
  return {
    routeKey,
    supportsImageInput: routeKey === 'premium',
    generate: vi.fn(
      async (request: AiProviderRequest): Promise<AiProviderResult> => ({
        rawText: validWritingFixture.providerOutput ?? '',
        model: 'gpt-5.6-luna',
        routeKey,
        latencyMs: 5,
        request,
      }),
    ),
  }
}

function setupWritingContext(
  providerTier: ProviderTier,
  routeKey: AiConcreteProviderRouteKey,
): ReturnType<typeof promptInputWithTier> {
  const promptInput = promptInputWithTier(providerTier)

  loadWritingFeedbackContext.mockResolvedValue({
    actor: { id: '11111111-1111-4111-8111-111111111111' },
    submission: {
      id: '22222222-2222-4222-8222-222222222222',
      assignmentId: '33333333-3333-4333-8333-333333333333',
      grade: null,
    },
    promptInput,
    routeKey,
    visibilityMode: 'teacher_reviewed',
    inputHash: sha256(promptInput),
  } as never)

  return promptInput
}

function queuedDraftInput(): QueuedDraftInput {
  return createAiFeedbackDraft.mock.calls[0]?.[0] as QueuedDraftInput
}

async function runWritingWorker(options: {
  harnessInput: QueuedHarnessInput
  initialRoute: AiConcreteProviderRouteKey
  health?: Partial<Record<AiConcreteProviderRouteKey, AiProviderHealthState>>
}) {
  const providers = {
    low_cost: provider('low_cost'),
    premium: provider('premium'),
  }
  const router = createAiProviderRouter({
    providers,
    health: options.health ?? {
      low_cost: 'healthy',
      premium: 'healthy',
    },
  })

  prisma.aiFeedbackDraft.findUnique.mockResolvedValue({
    id: '44444444-4444-4444-8444-444444444444',
    requesterId: '11111111-1111-4111-8111-111111111111',
    submissionId: '22222222-2222-4222-8222-222222222222',
    assignmentId: '33333333-3333-4333-8333-333333333333',
    promptVersion: 'ielts-writing-feedback-v1',
    provider: 'openai-compatible',
    routeKey: options.initialRoute,
    model: 'gpt-5.6-luna',
    status: 'queued',
    retryCount: 0,
    deletedAt: null,
  } as never)
  prisma.aiFeedbackDraft.updateMany.mockResolvedValue({ count: 1 } as never)

  await processWritingDraftJob(
    {
      id: 'job-1',
      name: 'ai-feedback.generate-writing-draft',
      data: {
        draftId: '44444444-4444-4444-8444-444444444444',
        harnessInput: options.harnessInput,
      },
      expireInSeconds: 60,
    },
    { providerRouter: router },
  )

  return { providers }
}

function finalDraftUpdate() {
  return prisma.aiFeedbackDraft.updateMany.mock.calls.at(-1)?.[0]
}

describe('writing feedback queue routing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    aiFeedbackConfig.enabled = true
    aiFeedbackConfig.apiKey = 'sk-test'
    aiFeedbackConfig.maxInputChars = 12_000
    prisma.$transaction.mockImplementation(async (callback) => callback(prisma))
    createAiFeedbackDraft.mockImplementation(async (input: unknown) => {
      const data = input as Record<string, unknown>

      return {
        id: '44444444-4444-4444-8444-444444444444',
        submissionId: data.submissionId,
        status: data.status,
        visibilityMode: data.visibilityMode,
        generatedFeedback: data.generatedFeedback,
      } as never
    })
  })

  it.each([
    ['low_cost', 'auto', 'premium', 'medium'],
    ['premium', 'low_cost', 'low_cost', 'high'],
  ] as const)(
    'propagates a %s regeneration override over an %s assignment',
    async (override, assignmentTier, assignmentRoute, expectedEffort) => {
      const originalPromptInput = setupWritingContext(assignmentTier, assignmentRoute)

      await regenerateAiWritingFeedback(
        { submissionId: '22222222-2222-4222-8222-222222222222' },
        { providerTier: override },
        { id: '11111111-1111-4111-8111-111111111111' } as never,
      )

      const draftInput = queuedDraftInput()
      const harnessInput = draftInput.generationJob.harnessInput
      const originalInputHash = sha256(originalPromptInput)
      const effectiveInputHash = sha256(harnessInput.promptInput)
      expect(draftInput).toEqual(
        expect.objectContaining({
          routeKey: override,
          model: 'gpt-5.6-luna',
          reasoningEffort: expectedEffort,
        }),
      )
      expect
        .soft(harnessInput.promptInput.assignment.config.aiPolicy?.providerTier)
        .toBe(override)
      expect(originalPromptInput.assignment.config.aiPolicy?.providerTier).toBe(
        assignmentTier,
      )
      expect(effectiveInputHash).not.toBe(originalInputHash)
      expect(draftInput.inputHash).toBe(effectiveInputHash)
      expect(harnessInput.fixtureId).toBe(
        `writing-feedback:22222222-2222-4222-8222-222222222222:${effectiveInputHash}`,
      )

      const { providers } = await runWritingWorker({
        harnessInput,
        initialRoute: draftInput.routeKey,
      })

      expect(providers[override].generate).toHaveBeenCalledOnce()
      const providerRequest = vi.mocked(providers[override].generate).mock.calls[0]?.[0]
      expect(providerRequest?.assignmentPolicy?.preferredRoute).toBe(override)
      const providerPayload = providerRequest?.messages[1]?.content
      expect(typeof providerPayload).toBe('string')
      if (typeof providerPayload === 'string') {
        expect(JSON.parse(providerPayload).assignment.ai_policy.provider_tier).toBe(
          override,
        )
      }
      expect(finalDraftUpdate()).toEqual(
        expect.objectContaining({
          data: expect.objectContaining({
            routeKey: override,
            reasoningEffort: expectedEffort,
          }),
        }),
      )
    },
  )

  it('checks an overridden queued prompt against the configured input limit', async () => {
    const originalPromptInput = setupWritingContext('auto', 'premium')
    const effectivePromptInput = promptInputWithTier('low_cost')
    aiFeedbackConfig.maxInputChars = stableJson(originalPromptInput).length

    expect(stableJson(effectivePromptInput).length).toBeGreaterThan(
      aiFeedbackConfig.maxInputChars,
    )

    await expect(
      regenerateAiWritingFeedback(
        { submissionId: '22222222-2222-4222-8222-222222222222' },
        { providerTier: 'low_cost' },
        { id: '11111111-1111-4111-8111-111111111111' } as never,
      ),
    ).rejects.toMatchObject({
      statusCode: 413,
      message: 'AI writing feedback input is too large.',
    })

    expect(createAiFeedbackDraft).not.toHaveBeenCalled()
    expect(originalPromptInput.assignment.config.aiPolicy?.providerTier).toBe('auto')
  })

  it('stores high reasoning when image capability routing changes low cost to premium', async () => {
    const visualFixture = writingHarnessFixtures.find(
      (fixture) => fixture.fixtureId === 'visual_task1_image_attached',
    )
    expect(visualFixture).toBeDefined()

    const harnessInput = {
      ...visualFixture,
      promptInput: {
        ...visualFixture?.promptInput,
        assignment: promptInputWithTier('low_cost').assignment,
      },
      routeKey: 'low_cost',
    } as QueuedHarnessInput

    const { providers } = await runWritingWorker({
      harnessInput,
      initialRoute: 'low_cost',
    })

    expect(providers.premium.generate).toHaveBeenCalledOnce()
    expect(finalDraftUpdate()).toEqual(
      expect.objectContaining({
        data: expect.objectContaining({
          routeKey: 'premium',
          reasoningEffort: 'high',
        }),
      }),
    )
  })

  it('stores medium reasoning when health fallback changes premium to low cost', async () => {
    const harnessInput = {
      fixtureId: 'writing-feedback:fallback',
      taskType: 'writing_feedback',
      promptInput: promptInputWithTier('auto'),
      routeKey: 'premium',
    } as QueuedHarnessInput

    const { providers } = await runWritingWorker({
      harnessInput,
      initialRoute: 'premium',
      health: {
        low_cost: 'healthy',
        premium: 'unhealthy',
      },
    })

    expect(providers.low_cost.generate).toHaveBeenCalledOnce()
    expect(finalDraftUpdate()).toEqual(
      expect.objectContaining({
        data: expect.objectContaining({
          routeKey: 'low_cost',
          reasoningEffort: 'medium',
        }),
      }),
    )
  })
})
