/** Staff read handlers return only authorized aggregates/pages; full work is fetched when opened. */
import type { Request, Response } from 'express'
import { createHttpError } from '../../utils/httpError.js'
import { withRecordingMetadata } from '../submissions/submissions.recording-metadata.js'
import {
  getStaffOverview,
  listStaffAssignments,
  listStaffSubmissions,
  getStaffAssignment,
  getStaffSubmission,
} from './assignments.staff-reads.js'

function actor(req: Request) {
  if (!req.user) throw createHttpError(401, 'Unauthorized')
  return req.user
}
export async function getOverview(req: Request, res: Response) {
  res.json(await getStaffOverview(actor(req)))
}
export async function getAssignmentSummaries(req: Request, res: Response) {
  res.json(await listStaffAssignments(req.query, actor(req)))
}
export async function getSubmissionSummaries(req: Request, res: Response) {
  res.json(await listStaffSubmissions(req.query, actor(req)))
}
export async function getAssignmentOverview(req: Request, res: Response) {
  res.json(await getStaffAssignment(req.params.assignmentId, actor(req)))
}
export async function getSubmissionDetail(req: Request, res: Response) {
  const data = await getStaffSubmission(req.params.submissionId, actor(req))
  res.json({ ...data, submission: (await withRecordingMetadata([data.submission]))[0] })
}
