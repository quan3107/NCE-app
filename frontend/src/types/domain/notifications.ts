/**
 * Location: src/types/domain/notifications.ts
 * Purpose: Define shared notification domain types used by the UI.
 * Why: Keeps backend notification payload mapping detached from mock modules.
 */

export type Notification = {
  id: string;
  userId: string;
  // Notification type keys are backend-driven and may expand over time.
  type: string;
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  link?: string;
};
