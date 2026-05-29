/**
 * File: src/modules/assignments/assignments.controller.ts
 * Purpose: Handle HTTP routing for assignment endpoints while delegating to services.
 * Why: Preserves a clean controller-service boundary for assignment workflows.
 */
import { type Request, type Response } from 'express'

import { createHttpError } from '../../utils/httpError.js'
import type { CourseManager } from '../courses/courses.types.js'
import {
  createAssignment,
  deleteAssignment,
  getAssignment,
  listAssignments,
  updateAssignment,
  getPendingAssignmentsCount as getPendingAssignmentsCountService,
} from './assignments.service.js'
import { createAssignmentSchema, updateAssignmentSchema } from './assignments.schema.js'

function getAuthenticatedActor(req: Request): CourseManager {
  if (!req.user) {
    throw createHttpError(401, 'Unauthorized')
  }

  return {
    id: req.user.id,
    role: req.user.role,
  }
}

export async function getAssignments(req: Request, res: Response): Promise<void> {
  const assignments = await listAssignments(req.params, getAuthenticatedActor(req))
  res.status(200).json(assignments)
}

export async function getAssignmentById(req: Request, res: Response): Promise<void> {
  const assignment = await getAssignment(req.params, getAuthenticatedActor(req))
  res.status(200).json(assignment)
}

export async function postAssignment(req: Request, res: Response): Promise<void> {
  const payload = createAssignmentSchema.parse(req.body)
  const assignment = await createAssignment(
    req.params,
    payload,
    getAuthenticatedActor(req),
  )
  res.status(201).json(assignment)
}

export async function patchAssignment(req: Request, res: Response): Promise<void> {
  const payload = updateAssignmentSchema.parse(req.body)
  const assignment = await updateAssignment(
    req.params,
    payload,
    getAuthenticatedActor(req),
  )
  res.status(200).json(assignment)
}

export async function deleteAssignmentById(req: Request, res: Response): Promise<void> {
  await deleteAssignment(req.params, getAuthenticatedActor(req))
  res.status(204).send()
}

/**
 * Get count of pending assignments for the authenticated student.
 */
export async function getPendingAssignmentsCount(
  req: Request,
  res: Response,
): Promise<void> {
  const user = req.user

  if (!user) {
    res.status(401).json({ message: 'Unauthorized' })
    return
  }

  const count = await getPendingAssignmentsCountService(user.id)
  res.status(200).json({ count })
}
