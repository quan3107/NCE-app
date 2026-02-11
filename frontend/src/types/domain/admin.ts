/**
 * Location: src/types/domain/admin.ts
 * Purpose: Define shared admin-facing audit contracts for frontend screens.
 * Why: Keeps admin type contracts stable without importing from mock data.
 */

export type AuditLog = {
  id: string;
  actor: string;
  action: string;
  entity: string;
  timestamp: Date;
  details: string;
};
