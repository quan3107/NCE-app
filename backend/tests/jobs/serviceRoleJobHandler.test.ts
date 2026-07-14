/**
 * File: tests/jobs/serviceRoleJobHandler.test.ts
 * Purpose: Verify every wrapped pg-boss callback receives trusted Prisma context.
 * Why: Background handlers do not pass through request-scoped RLS middleware.
 */
import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  withRoleContext: vi.fn((_options: unknown, operation: () => Promise<void>) =>
    operation(),
  ),
}))

vi.mock('../../src/prisma/client.js', () => ({
  withRoleContext: mocks.withRoleContext,
}))

describe('service-role job handler', () => {
  it('runs the underlying callback inside service_role context', async () => {
    const handler = vi.fn(async (_value: string) => undefined)
    const { withServiceRoleJobHandler } =
      await import('../../src/jobs/serviceRoleJobHandler.js')

    const wrapped = withServiceRoleJobHandler(handler)
    await wrapped('payload')

    expect(mocks.withRoleContext).toHaveBeenCalledWith(
      { role: 'service_role' },
      expect.any(Function),
    )
    expect(handler).toHaveBeenCalledWith('payload')
  })
})
