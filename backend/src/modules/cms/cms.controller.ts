/**
 * Location: backend/src/modules/cms/cms.controller.ts
 * Purpose: controller for CMS/marketing content enpoints
 * Why: Business logic for serving marketing content from database/config
 */
import { Request, Response } from 'express'
import * as cmsService from './cms.service.js'

export const getHomepageContent = async (_req: Request, res: Response) => {
  try {
    const content = await cmsService.getHomepageContent()
    res.json(content)
  } catch (error) {
    console.error('Error fetching homepage content: ', error)
    res.status(500).json({
      message: 'Failed to fetch homepage content',
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

export const getAboutPageContent = async (_req: Request, res: Response) => {
  try {
    const content = await cmsService.getAboutPageContent()
    res.json(content)
  } catch (error) {
    console.error('Error fetching about page content: ', error)
    res.status(500).json({
      message: 'Failed to fetch about page content',
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

export const refreshStats = async (_req: Request, res: Response) => {
  try {
    await cmsService.updateHomepageStatsWithRealtimeData()
    const content = await cmsService.getHomepageContent()
    res.json({
      message: 'Stats refreshed successfully',
      content,
    })
  } catch (error) {
    console.error('Error refreshing stats: ', error)
    res.status(500).json({
      message: 'Failed to refresh stats',
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}
