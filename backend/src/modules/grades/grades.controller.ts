/**
 * File: src/modules/grades/grades.controller.ts
 * Purpose: Provide HTTP handlers for grading operations backed by Prisma services.
 * Why: Maintains the controller-service split for the grading domain.
 */
import { type Request, type Response } from 'express'

import { getGrade, upsertGrade } from './grades.service.js'
import { gradePayloadSchema } from './grades.schema.js'

export async function putGrade(req: Request, res: Response): Promise<void> {
  const payload = gradePayloadSchema
    .required({ expectedSubmissionVersion: true })
    .parse(req.body)
  const grade = await upsertGrade(req.params, payload, req.user)
  res.status(200).json(grade)
}

export async function getSubmissionGrade(req: Request, res: Response): Promise<void> {
  const grade = await getGrade(req.params, req.user)
  res.status(200).json(grade)
}
