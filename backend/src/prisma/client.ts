/**
 * File: src/prisma/client.ts
 * Purpose: Provide a shared Prisma client instance for data access.
 * Why: Centralizes Prisma usage so services reuse one client with consistent setup.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export { prisma };
