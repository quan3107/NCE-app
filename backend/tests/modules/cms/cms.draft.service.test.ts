/**
 * File: tests/modules/cms/cms.draft.service.test.ts
 * Purpose: Verify CMS draft saves are versioned only when content changes.
 * Why: An unchanged save must not create a false unpublished draft or audit event.
 */
import { beforeEach, expect, it, vi } from 'vitest'

const transactionClient = {
  $queryRaw: vi.fn(),
  cmsPageContent: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  cmsPageDraft: { upsert: vi.fn() },
}

vi.mock('../../../src/prisma/client.js', () => ({
  prisma: {
    $transaction: vi.fn(async (operation) => operation(transactionClient)),
  },
}))
vi.mock('../../../src/modules/audit-logs/audit-logs.service.js', () => ({
  writeAuditLogSafely: vi.fn(),
}))

const auditModule = await import('../../../src/modules/audit-logs/audit-logs.service.js')
const writeAuditLogSafely = vi.mocked(auditModule.writeAuditLogSafely)
const { updateCmsDraft } = await import('../../../src/modules/cms/cms.admin.service.js')

const content = {
  hero: {
    badge: 'Draft badge',
    title: 'Draft title',
    description: 'Draft description',
    cta_primary: 'Browse',
    cta_secondary: 'Sign in',
  },
  stats: [],
  howItWorks: { title: 'How it works', description: 'Steps', features: [] },
}

beforeEach(() => {
  vi.clearAllMocks()
  transactionClient.$queryRaw.mockResolvedValue([{ id: 'page-1' }])
})

it('returns the current state without writes when draft content is unchanged', async () => {
  transactionClient.cmsPageContent.findUnique.mockResolvedValue({
    id: 'page-1',
    pageKey: 'homepage',
    label: 'Homepage',
    draft: { content },
    sections: [],
    draftVersion: 3,
    publishedDraftVersion: 3,
    publishedRevision: 1,
    publishedAt: new Date('2026-07-01T00:00:00.000Z'),
    updatedAt: new Date('2026-07-10T00:00:00.000Z'),
  })

  const result = await updateCmsDraft(
    'homepage',
    structuredClone(content),
    3,
    { id: '15eb1f4b-09a0-48e1-8844-c8f5cf7fa30b' },
  )

  expect(result.draftVersion).toBe(3)
  expect(result.hasUnpublishedChanges).toBe(false)
  expect(transactionClient.cmsPageContent.update).not.toHaveBeenCalled()
  expect(transactionClient.cmsPageDraft.upsert).not.toHaveBeenCalled()
  expect(writeAuditLogSafely).not.toHaveBeenCalled()
})
