/**
 * File: src/modules/audit-logs/contracts/auth-users.ts
 * Purpose: Define strict auth and user-management audit event contracts.
 * Why: Identity operations need traceability without request, credential, or profile payloads.
 */
import { z } from 'zod'

import { changedMarkerSchema, userRoleSchema, userStatusSchema } from './common.js'

const authOutcomeShape = {
  role: userRoleSchema,
  status: userStatusSchema,
}

export const authUserAuditContracts = {
  'auth.login_succeeded': {
    entity: 'auth_session',
    schema: z.strictObject(authOutcomeShape),
  },
  'auth.google_login_succeeded': {
    entity: 'auth_session',
    schema: z.strictObject({
      ...authOutcomeShape,
      identityLinked: z.boolean(),
      emailVerifiedUpdated: z.boolean(),
    }),
  },
  'auth.registered': {
    entity: 'user',
    schema: z.strictObject(authOutcomeShape),
  },
  'auth.session_refreshed': {
    entity: 'auth_session',
    schema: z.strictObject({ sessionRotated: changedMarkerSchema }),
  },
  'auth.session_revoked': {
    entity: 'auth_session',
    schema: z.strictObject({ sessionRevoked: changedMarkerSchema }),
  },
  'user.created': {
    entity: 'user',
    schema: z.strictObject(authOutcomeShape),
  },
  'user.invited': {
    entity: 'user',
    schema: z.strictObject(authOutcomeShape),
  },
  'user.profile_updated': {
    entity: 'user',
    schema: z.strictObject({
      fullNameChanged: z.literal(true),
    }),
  },
  'user.teacher_approved': {
    entity: 'user',
    schema: z.strictObject({
      previousStatus: z.literal('pending'),
      status: z.literal('active'),
    }),
  },
  'user.teacher_rejected': {
    entity: 'user',
    schema: z.strictObject({
      previousStatus: z.literal('pending'),
      status: z.literal('suspended'),
    }),
  },
  'user.status_changed': {
    entity: 'user',
    schema: z.strictObject({
      previousStatus: z.enum(['active', 'suspended']),
      status: z.enum(['active', 'suspended']),
    }),
  },
  'user.deleted': {
    entity: 'user',
    schema: z.strictObject({ softDeleted: z.literal(true) }),
  },
} as const
