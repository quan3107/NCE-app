/**
 * File: scripts/databaseConnectionPolicy.ts
 * Purpose: Re-export the shared owner database connection policy for scripts.
 * Why: Script entrypoints and source commands must enforce one transport boundary.
 */

export * from '../src/databaseConnectionPolicy.js'
