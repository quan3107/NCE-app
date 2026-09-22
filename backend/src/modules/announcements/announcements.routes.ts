/** Announcement HTTP routes: require authentication before the service checks course access. */
import { Router } from 'express'
import { authGuard } from '../../middleware/authGuard.js'
import {
  createAnnouncement,
  deleteAnnouncement,
  editAnnouncement,
  listAnnouncements,
} from './announcements.service.js'

export const announcementRouter = Router({ mergeParams: true })
announcementRouter.use(authGuard)
announcementRouter.get('/', async (req, res) => {
  res.json(await listAnnouncements(req.params, req.query, req.user!))
})
announcementRouter.post('/', async (req, res) => {
  res.status(201).json(await createAnnouncement(req.params, req.body, req.user!))
})
announcementRouter.patch('/:announcementId', async (req, res) => {
  res.json(await editAnnouncement(req.params, req.body, req.user!))
})
announcementRouter.delete('/:announcementId', async (req, res) => {
  await deleteAnnouncement(req.params, req.user!)
  res.status(204).end()
})
