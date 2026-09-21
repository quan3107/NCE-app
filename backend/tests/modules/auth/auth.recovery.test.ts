/**
 * File: tests/modules/auth/auth.recovery.test.ts
 * Purpose: Verify secret issuance and provider-failure privacy at the service boundary.
 * Why: Email delivery is isolated here; real Browser/API delivery has separate evidence.
 */
import { createHash } from 'node:crypto'
import { beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ updateMany: vi.fn(), send: vi.fn() }))
vi.mock('../../../src/config/prismaClient.js', () => ({
  prisma: { user: { updateMany: mocks.updateMany } },
}))
vi.mock('../../../src/prisma/client.js', () => ({
  runWithRole: async (_role: unknown, callback: () => Promise<unknown>) => callback(),
}))
vi.mock('../../../src/utils/emailClient.js', () => ({
  sendNotificationEmail: mocks.send,
}))
import {
  requestPasswordReset,
  PASSWORD_RESET_TTL_MS,
} from '../../../src/modules/auth/auth.recovery.js'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.send.mockResolvedValue(undefined)
})

it('stores only a digest and sends a 256-bit fragment token to the normalized account email', async () => {
  mocks.updateMany.mockResolvedValue({ count: 1 })
  const started = Date.now()
  await requestPasswordReset({ email: '  Controlled@Example.invalid ' })
  const query = mocks.updateMany.mock.calls[0][0]
  const mail = mocks.send.mock.calls[0][0]
  const link = new URL(mail.bodyText.match(/https?:\/\/[^\s]+/)[0])
  const token = new URLSearchParams(link.hash.slice(1)).get('token')!
  expect(token).toMatch(/^[a-f0-9]{64}$/)
  expect(query.data.passwordResetHash).toBe(
    createHash('sha256').update(token).digest('hex'),
  )
  expect(query.data.passwordResetExpiresAt.getTime() - started).toBeGreaterThanOrEqual(
    PASSWORD_RESET_TTL_MS,
  )
  expect(query.data.passwordResetExpiresAt.getTime() - started).toBeLessThan(
    PASSWORD_RESET_TTL_MS + 1000,
  )
  expect(query.where).toMatchObject({
    email: 'controlled@example.invalid',
    deletedAt: null,
    status: 'active',
    password: { not: null },
  })
  expect(mail.to).toBe('controlled@example.invalid')
  expect(link.pathname).toBe('/reset-password')
  expect(link.search).toBe('')
})

it('sends no email for an unknown, ineligible, or cooldown account', async () => {
  mocks.updateMany.mockResolvedValue({ count: 0 })
  await expect(
    requestPasswordReset({ email: 'unknown@example.invalid' }),
  ).resolves.toBeUndefined()
  expect(mocks.send).not.toHaveBeenCalled()
})

it('acknowledges before delivery completes and invalidates only the failed issuance', async () => {
  mocks.updateMany.mockResolvedValue({ count: 1 })
  let rejectDelivery!: (error: Error) => void
  mocks.send.mockReturnValue(
    new Promise((_resolve, reject) => {
      rejectDelivery = reject
    }),
  )
  await expect(
    requestPasswordReset({ email: 'controlled@example.invalid' }),
  ).resolves.toBeUndefined()
  const issuedHash = mocks.updateMany.mock.calls[0][0].data.passwordResetHash
  rejectDelivery(new Error('Provider unavailable'))
  await vi.waitFor(() => expect(mocks.updateMany).toHaveBeenCalledTimes(2))
  expect(mocks.updateMany.mock.calls[1][0]).toEqual({
    where: { passwordResetHash: issuedHash },
    data: { passwordResetHash: null, passwordResetExpiresAt: null },
  })
})
