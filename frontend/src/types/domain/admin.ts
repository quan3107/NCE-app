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
  entityId: string;
  eventData: Record<string, unknown>;
  schemaVersion: number;
  timestamp: Date;
  details: string;
};
