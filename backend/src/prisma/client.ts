/**
 * File: src/prisma/client.ts
 * Purpose: Provide Prisma clients with request-scoped role context for RLS.
 * Why: Keeps database role switching centralized so RLS policies are enforced.
 */
import { AsyncLocalStorage } from 'node:async_hooks'

import { Prisma, PrismaClient } from '@prisma/client'

type PrismaRole = 'authenticated' | 'anon' | 'service_role'

type RoleContext = {
  client: PrismaClient | Prisma.TransactionClient
}

const prismaContext = new AsyncLocalStorage<RoleContext>()
const basePrisma = new PrismaClient()

const prismaProxy = new Proxy(basePrisma, {
  get(target, prop, receiver) {
    if (
      prop === '$connect' ||
      prop === '$disconnect' ||
      prop === '$on' ||
      prop === '$extends'
    ) {
      return (target as PrismaClient)[prop].bind(target)
    }

    if (prop === '$transaction') {
      return (...args: Parameters<PrismaClient['$transaction']>) => {
        const store = prismaContext.getStore()
        const contextualClient = store?.client
        if (contextualClient && contextualClient !== target) {
          const [input] = args
          if (Array.isArray(input)) {
            return Promise.all(input)
          }
          if (typeof input === 'function') {
            return input(contextualClient as Prisma.TransactionClient)
          }
        }
        return (target as PrismaClient).$transaction(...args)
      }
    }

    const store = prismaContext.getStore()
    const client = store?.client ?? target
    const value = (client as typeof target)[prop as keyof typeof target]
    if (typeof value === 'function') {
      return value.bind(client)
    }
    return value
  },
})

export function withPrismaClient<T>(
  client: PrismaClient | Prisma.TransactionClient,
  fn: () => Promise<T>,
): Promise<T> {
  return prismaContext.run({ client }, fn)
}

type RoleContextOptions = {
  role: PrismaRole
  userId?: string
  userRole?: string
}

async function applyRoleContext(
  tx: Prisma.TransactionClient,
  options: RoleContextOptions,
): Promise<void> {
  await tx.$executeRawUnsafe(`set local role ${options.role}`)
  await tx.$executeRaw`
    select set_config('app.current_user_id', ${options.userId ?? ''}, true)
  `
  await tx.$executeRaw`
    select set_config('app.current_user_role', ${options.userRole ?? options.role}, true)
  `
}

export async function runWithRole<T>(
  options: RoleContextOptions,
  fn: () => Promise<T>,
): Promise<T> {
  return basePrisma.$transaction(async (tx) => {
    await applyRoleContext(tx, options)
    return withPrismaClient(tx, fn)
  })
}

export const prisma = prismaProxy as PrismaClient
export { basePrisma }
