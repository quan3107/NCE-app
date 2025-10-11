/**
 * File: src/config/prismaClient.ts
 * Purpose: Expose a singleton Prisma client for database access across modules.
 * Why: Prevents redundant client instantiation while centralizing query configuration.
 */
import { PrismaClient } from "@prisma/client";

type GlobalWithPrisma = typeof globalThis & {
  __prisma?: PrismaClient;
};

const globalRef = globalThis as GlobalWithPrisma;

export const prisma =
  globalRef.__prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["info", "warn", "error"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalRef.__prisma = prisma;
}

