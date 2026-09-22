/**
 * File: src/modules/auth/auth.google.issuer.ts
 * Purpose: Share Google's exact trusted issuer spellings and canonical storage value.
 * Why: Legacy identities and pending proofs must accept either signed-token spelling.
 */
export const GOOGLE_ALLOWED_ISSUERS = [
  'https://accounts.google.com',
  'accounts.google.com',
] as const

// Do not apply general URL normalization: only these two exact issuers are trusted.
export function normalizeGoogleIssuer(issuer: string | null | undefined) {
  return issuer === GOOGLE_ALLOWED_ISSUERS[0] || issuer === GOOGLE_ALLOWED_ISSUERS[1]
    ? GOOGLE_ALLOWED_ISSUERS[0]
    : null
}
