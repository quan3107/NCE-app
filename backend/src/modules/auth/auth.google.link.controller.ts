/**
 * File: src/modules/auth/auth.google.link.controller.ts
 * Purpose: Expose browser-bound link inspection, consent, and cancellation.
 * Why: A readable challenge ID plus HttpOnly proof protects against CSRF.
 */
import type { Request, Response } from 'express'
import {
  cancelGoogleLink,
  confirmGoogleLink,
  readGoogleLinkChallenge,
  GOOGLE_LINK_COOKIE,
} from './auth.google.link.js'
import {
  clearGoogleCookie,
  readCookie,
  sessionContextFromRequest,
} from './auth.cookies.js'
export async function inspectGoogleLink(req: Request, res: Response): Promise<void> {
  res.set('Cache-Control', 'no-store')
  res.json(await readGoogleLinkChallenge(readCookie(req, GOOGLE_LINK_COOKIE)))
}
export async function linkGoogleAccount(req: Request, res: Response): Promise<void> {
  res.set('Cache-Control', 'no-store')
  await confirmGoogleLink(
    readCookie(req, GOOGLE_LINK_COOKIE),
    req.body,
    sessionContextFromRequest(req),
  )
  clearGoogleCookie(res, GOOGLE_LINK_COOKIE)
  res.status(204).send()
}
export async function declineGoogleLink(req: Request, res: Response): Promise<void> {
  res.set('Cache-Control', 'no-store')
  await cancelGoogleLink(readCookie(req, GOOGLE_LINK_COOKIE), req.body)
  clearGoogleCookie(res, GOOGLE_LINK_COOKIE)
  res.status(204).send()
}
