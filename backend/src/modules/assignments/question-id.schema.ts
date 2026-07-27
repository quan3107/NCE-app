/**
 * File: src/modules/assignments/question-id.schema.ts
 * Purpose: Define the canonical assignment question identifier contract.
 * Why: Question identities must survive configuration, jobs, routes, persistence, and audits unchanged.
 */
import { z } from 'zod'

export const questionIdSchema = z.string().min(1)
