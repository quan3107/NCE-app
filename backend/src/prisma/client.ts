/**
 * File: src/prisma/client.ts
 * Purpose: Provide Prisma clients with request-scoped role context for RLS.
 * Why: Keeps database role switching centralized so RLS policies are enforced.
 */
import { AsyncLocalStorage } from 'node:async_hooks'

import { Prisma, PrismaClient } from '@prisma/client'

type PrismaRole = 'authenticated' | 'anon' | 'service_role'

type RoleContextOptions = {
  role: PrismaRole
  userId?: string
  userRole?: string
}

type RequestContext = {
  client?: PrismaClient | Prisma.TransactionClient
  role?: RoleContextOptions
}

const prismaContext = new AsyncLocalStorage<RequestContext>()
const basePrisma = new PrismaClient()

async function runWithRoleContext<T>(
  options: RoleContextOptions,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return basePrisma.$transaction(async (tx) => {
    await applyRoleContext(tx, options)
    return fn(tx)
  })
}

// Wrap each query in a short transaction when role context is present so
// SET LOCAL is scoped safely without holding a request-wide transaction.
const rlsPrisma = basePrisma.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        const store = prismaContext.getStore()
        if (store?.client) {
          return query(args)
        }
        const roleContext = store?.role
        if (!roleContext) {
          return query(args)
        }
        if (!model) {
          const queryFn = query as (input: unknown) => Promise<unknown>
          return queryFn(args)
        }
        return runWithRoleContext(roleContext, (tx) => {
          const delegate = (tx as Record<string, any>)[model]
          return delegate[operation](args)
        })
      },
    },
  },
  client: {
    async $queryRaw(...args: Parameters<PrismaClient['$queryRaw']>) {
      const store = prismaContext.getStore()
      if (store?.client) {
        return (store.client as Prisma.TransactionClient).$queryRaw(...args)
      }
      const roleContext = store?.role
      if (!roleContext) {
        return basePrisma.$queryRaw(...args)
      }
      return runWithRoleContext(roleContext, (tx) =>
        (tx as Prisma.TransactionClient).$queryRaw(...args),
      )
    },
    async $executeRaw(...args: Parameters<PrismaClient['$executeRaw']>) {
      const store = prismaContext.getStore()
      if (store?.client) {
        return (store.client as Prisma.TransactionClient).$executeRaw(...args)
      }
      const roleContext = store?.role
      if (!roleContext) {
        return basePrisma.$executeRaw(...args)
      }
      return runWithRoleContext(roleContext, (tx) =>
        (tx as Prisma.TransactionClient).$executeRaw(...args),
      )
    },
    async $queryRawUnsafe(
      ...args: Parameters<PrismaClient['$queryRawUnsafe']>
    ) {
      const store = prismaContext.getStore()
      if (store?.client) {
        return (store.client as Prisma.TransactionClient).$queryRawUnsafe(...args)
      }
      const roleContext = store?.role
      if (!roleContext) {
        return basePrisma.$queryRawUnsafe(...args)
      }
      return runWithRoleContext(roleContext, (tx) =>
        (tx as Prisma.TransactionClient).$queryRawUnsafe(...args),
      )
    },
    async $executeRawUnsafe(
      ...args: Parameters<PrismaClient['$executeRawUnsafe']>
    ) {
      const store = prismaContext.getStore()
      if (store?.client) {
        return (store.client as Prisma.TransactionClient).$executeRawUnsafe(...args)
      }
      const roleContext = store?.role
      if (!roleContext) {
        return basePrisma.$executeRawUnsafe(...args)
      }
      return runWithRoleContext(roleContext, (tx) =>
        (tx as Prisma.TransactionClient).$executeRawUnsafe(...args),
      )
    },
  },
})

const prismaProxy = new Proxy(rlsPrisma, {
  get(target, prop, receiver) {
    if (
      prop === '$connect' ||
      prop === '$disconnect' ||
      prop === '$on' ||
      prop === '$extends'
    ) {
      return (target as unknown as PrismaClient)[prop].bind(target)
    }

    if (prop === '$transaction') {
      return (...args: Parameters<PrismaClient['$transaction']>) => {
        const store = prismaContext.getStore()
        const contextualClient = store?.client
        if (contextualClient) {
          const [input] = args
          if (Array.isArray(input)) {
            return Promise.all(input)
          }
          if (typeof input === 'function') {
            return input(contextualClient as Prisma.TransactionClient)
          }
        }
        const [input, options] = args
        if (typeof input === 'function') {
          return basePrisma.$transaction(
            async (tx) => {
              const roleContext = store?.role
              if (roleContext) {
                await applyRoleContext(tx, roleContext)
              }
              return withPrismaClient(tx, () => input(tx))
            },
            options,
          )
        }
        return (target as unknown as PrismaClient).$transaction(...args)
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
  const current = prismaContext.getStore()
  return prismaContext.run({ client, role: current?.role }, fn)
}

export function withRoleContext<T>(
  options: RoleContextOptions,
  fn: () => Promise<T> | T,
): Promise<T> | T {
  const current = prismaContext.getStore()
  return prismaContext.run({ client: current?.client, role: options }, fn)
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

export const prisma = prismaProxy as unknown as PrismaClient
export { basePrisma }
