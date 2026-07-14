/**
 * File: src/jobs/serviceRoleJobHandler.ts
 * Purpose: Run registered application job handlers in the trusted database role.
 * Why: pg-boss callbacks execute outside request-scoped RLS context.
 */
import { withRoleContext } from '../prisma/client.js'

type AsyncJobHandler<Args extends unknown[]> = (...args: Args) => Promise<void>

export function withServiceRoleJobHandler<Args extends unknown[]>(
  handler: AsyncJobHandler<Args>,
): AsyncJobHandler<Args> {
  return async (...args) => {
    await withRoleContext({ role: 'service_role' }, () => handler(...args))
  }
}
