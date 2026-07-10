/**
 * Location: backend/src/modules/cms/cms.routes.ts
 * Purpose: CMS endpoints for marketing content
 * Why: Route definitions for CMS module
 */
import { Router } from 'express'
import { authGuard } from '../../middleware/authGuard.js'
import { roleGuard } from '../../middleware/roleGuard.js'
import { UserRole } from '../../prisma/index.js'
import {
  getHomepageContent,
  getAboutPageContent,
  getContactPageContent,
  getAdminDraft,
  getAdminPages,
  getAdminPreview,
  getAdminRevisions,
  postAdminPublish,
  postAdminRollback,
  putAdminDraft,
  refreshStats,
} from './cms.controller.js'

const router = Router()

router.get('/homepage-content', getHomepageContent)
router.get('/about-page-content', getAboutPageContent)
router.get('/contact-page-content', getContactPageContent)
router.get('/admin/pages', authGuard, roleGuard([UserRole.admin]), getAdminPages)
router.get(
  '/admin/pages/:pageKey/draft',
  authGuard,
  roleGuard([UserRole.admin]),
  getAdminDraft,
)
router.put(
  '/admin/pages/:pageKey/draft',
  authGuard,
  roleGuard([UserRole.admin]),
  putAdminDraft,
)
router.get(
  '/admin/pages/:pageKey/preview',
  authGuard,
  roleGuard([UserRole.admin]),
  getAdminPreview,
)
router.post(
  '/admin/pages/:pageKey/publish',
  authGuard,
  roleGuard([UserRole.admin]),
  postAdminPublish,
)
router.get(
  '/admin/pages/:pageKey/revisions',
  authGuard,
  roleGuard([UserRole.admin]),
  getAdminRevisions,
)
router.post(
  '/admin/pages/:pageKey/revisions/:revisionId/rollback',
  authGuard,
  roleGuard([UserRole.admin]),
  postAdminRollback,
)
router.post(
  '/refresh-stats',
  authGuard,
  roleGuard([UserRole.admin]),
  refreshStats,
)

export default router
