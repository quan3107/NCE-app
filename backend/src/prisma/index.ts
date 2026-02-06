/**
 * File: src/prisma/index.ts
 * Purpose: Provide the stable app-facing Prisma exports for runtime and generated types.
 * Why: Gives modules/tests one local import surface independent of generation paths.
 */
export * from './client.js'
export * from './generated.js'
