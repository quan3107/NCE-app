/**
 * File: src/config/prismaClient.ts
 * Purpose: Re-export the shared Prisma client with RLS context support.
 * Why: Keeps legacy import paths working while centralizing DB role handling.
 */
export { prisma, runWithRole } from "../prisma/client.js";
