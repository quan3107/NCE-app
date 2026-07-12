/**
 * File: tests/modules/cms/cms.stored-content-errors.test.ts
 * Purpose: Verify malformed persisted CMS rows are reported as internal failures.
 * Why: Database corruption is a server fault, while request schema failures remain HTTP 400.
 */
import type { NextFunction, Request, Response } from 'express'
import { describe, expect, it, vi } from 'vitest'

const findUnique = vi.fn()

vi.mock('../../../src/prisma/client.js', () => ({
  prisma: {
    cmsPageContent: { findUnique },
  },
}))

const { errorHandler } = await import('../../../src/middleware/errorHandler.js')
const { validateStoredCmsPageContent } =
  await import('../../../src/modules/cms/cms.content.js')
const { StoredCmsContentError } =
  await import('../../../src/modules/cms/cms.errors.js')
const { getHomepageContent } = await import('../../../src/modules/cms/cms.service.js')

describe('CMS stored content errors', () => {
  it('returns an unexposed 500 when persisted public content is invalid', async () => {
    findUnique.mockResolvedValueOnce({ sections: [] })

    let capturedError: Error | undefined
    try {
      await getHomepageContent()
    } catch (error) {
      capturedError = error as Error
    }

    expect(capturedError).toBeDefined()
    expect(capturedError).toBeInstanceOf(StoredCmsContentError)

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as Response

    errorHandler(
      capturedError!,
      {} as Request,
      res,
      vi.fn() as NextFunction,
    )

    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith({ message: 'Internal Server Error' })
  })

  it('classifies invalid stored draft and revision snapshots as internal errors', () => {
    expect(() => validateStoredCmsPageContent('contact', {})).toThrow(
      StoredCmsContentError,
    )
  })
})
