/**
 * File: src/modules/users/users.routes.ts
 * Purpose: Register REST endpoints for user administration.
 * Why: Provides a stable routing layer that aligns with the layered architecture.
 */
import { UserRole } from '../../prisma/index.js'
import { Router } from 'express'

import { authGuard } from '../../middleware/authGuard.js'
import { roleGuard } from '../../middleware/roleGuard.js'
import {
  getUser,
  getUsers,
  deleteUser,
  patchUserStatus,
  postTeacherApproval,
  postTeacherRejection,
  postUser,
  postUserInvite,
} from './users.controller.js'

export const userRouter = Router()

userRouter.use(authGuard)
userRouter.use(roleGuard([UserRole.admin]))

userRouter.get('/', getUsers)
userRouter.post('/', postUser)
userRouter.post('/invite', postUserInvite)
userRouter.post('/:userId/approve-teacher', postTeacherApproval)
userRouter.post('/:userId/reject-teacher', postTeacherRejection)
userRouter.patch('/:userId/status', patchUserStatus)
userRouter.delete('/:userId', deleteUser)
userRouter.get('/:userId', getUser)
