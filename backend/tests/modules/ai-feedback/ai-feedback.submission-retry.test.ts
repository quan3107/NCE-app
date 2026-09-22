/** Submission retries must reuse queued/completed AI work instead of creating duplicate drafts. */
import { expect, it, vi } from 'vitest'
import { UserRole, UserStatus } from '../../../src/prisma/index.js'

vi.mock(
  '../../../src/modules/ai-feedback/ai-feedback.writing-feedback.context.js',
  () => ({
    loadWritingFeedbackContext: vi.fn(),
    loadWritingFeedbackStatusContext: vi.fn(),
  }),
)
vi.mock('../../../src/modules/ai-feedback/ai-feedback.repository.js', () => ({
  findLatestAiFeedbackDraftBySubmission: vi.fn(),
  createAiFeedbackDraft: vi.fn(),
  supersedeAiFeedbackDrafts: vi.fn(),
}))
vi.mock(
  '../../../src/modules/ai-feedback/ai-feedback.writing-feedback.support.js',
  async (original) => ({
    ...(await original<Record<string, unknown>>()),
    toWritingFeedbackResponse: (draft: unknown) => draft,
  }),
)
const repository =
  await import('../../../src/modules/ai-feedback/ai-feedback.repository.js')
const context =
  await import('../../../src/modules/ai-feedback/ai-feedback.writing-feedback.context.js')
const { sha256 } =
  await import('../../../src/modules/ai-feedback/ai-feedback.writing-feedback.support.js')
const { enqueueAiWritingFeedbackForSubmission } =
  await import('../../../src/modules/ai-feedback/ai-feedback.writing-feedback.js')

it.each(['queued', 'accepted', 'approved'])(
  'reuses %s feedback for the same input',
  async (status) => {
    const promptInput = { response: 'The same submitted essay.' }
    vi.mocked(context.loadWritingFeedbackContext).mockResolvedValue({
      submission: { id: 'submission' },
      promptInput,
    } as never)
    const draft = { id: 'draft', status, inputHash: sha256(promptInput) }
    vi.mocked(repository.findLatestAiFeedbackDraftBySubmission).mockResolvedValue(
      draft as never,
    )
    expect(
      await enqueueAiWritingFeedbackForSubmission('submission', {
        id: 'student',
        role: UserRole.student,
        status: UserStatus.active,
      }),
    ).toBe(draft)
    expect(repository.createAiFeedbackDraft).not.toHaveBeenCalled()
    expect(repository.supersedeAiFeedbackDrafts).not.toHaveBeenCalled()
  },
)
