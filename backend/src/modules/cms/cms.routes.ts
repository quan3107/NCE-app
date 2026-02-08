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
  refreshStats,
} from './cms.controller.js'

const router = Router()

router.get('/homepage-content', getHomepageContent)
router.get('/about-page-content', getAboutPageContent)
router.post(
  '/refresh-stats',
  authGuard,
  roleGuard([UserRole.admin]),
  refreshStats,
)

export default router
