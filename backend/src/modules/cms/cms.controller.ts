/**
 * Location: backend/src/modules/cms/cms.controller.ts
 * Purpose: Bridge public and admin CMS HTTP requests to the CMS services.
 * Why: Keeps response status and authenticated actor handling out of domain logic.
 */
import { type Request, type Response } from 'express'
import { createHttpError } from '../../utils/httpError.js'
import {
  CmsDraftUpdateSchema,
  CmsPageKeySchema,
  CmsPublishSchema,
  CmsRevisionQuerySchema,
  CmsRollbackParamsSchema,
  CmsRollbackSchema,
} from './cms.schema.js'
import * as cmsService from './cms.service.js'

function actorFromRequest(req: Request) {
  if (!req.user) throw createHttpError(401, 'Unauthorized')
  return req.user
}

export async function getHomepageContent(_req: Request, res: Response) {
  res.json(await cmsService.getHomepageContent())
}

export async function getAboutPageContent(_req: Request, res: Response) {
  res.json(await cmsService.getAboutPageContent())
}

export async function getContactPageContent(_req: Request, res: Response) {
  res.json(await cmsService.getContactPageContent())
}

export async function getAdminPages(_req: Request, res: Response) {
  res.json(await cmsService.listCmsPages())
}

export async function getAdminDraft(req: Request, res: Response) {
  res.json(await cmsService.getCmsDraft(req.params.pageKey))
}

export async function putAdminDraft(req: Request, res: Response) {
  const { content, expectedDraftVersion } = CmsDraftUpdateSchema.parse(req.body)
  res.json(
    await cmsService.updateCmsDraft(
      req.params.pageKey,
      content,
      expectedDraftVersion,
      actorFromRequest(req),
    ),
  )
}

export async function getAdminPreview(req: Request, res: Response) {
  res.json(await cmsService.getCmsPreview(req.params.pageKey))
}

export async function postAdminPublish(req: Request, res: Response) {
  const { content, expectedDraftVersion } = CmsPublishSchema.parse(req.body)
  res.json(
    await cmsService.publishCmsDraft(
      req.params.pageKey,
      content,
      expectedDraftVersion,
      actorFromRequest(req),
    ),
  )
}

export async function getAdminRevisions(req: Request, res: Response) {
  const pageKey = CmsPageKeySchema.parse(req.params.pageKey)
  const query = CmsRevisionQuerySchema.parse(req.query)
  res.json(await cmsService.listCmsRevisions(pageKey, query))
}

export async function postAdminRollback(req: Request, res: Response) {
  const { pageKey, revisionId } = CmsRollbackParamsSchema.parse(req.params)
  const { expectedDraftVersion } = CmsRollbackSchema.parse(req.body)
  res.json(
    await cmsService.rollbackCmsRevision(
      pageKey,
      revisionId,
      expectedDraftVersion,
      actorFromRequest(req),
    ),
  )
}

export async function refreshStats(_req: Request, res: Response) {
  await cmsService.updateHomepageStatsWithRealtimeData()
  const content = await cmsService.getHomepageContent()
  res.json({ message: 'Stats refreshed successfully', content })
}
