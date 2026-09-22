/** Notification job names and compatibility handlers for persisted queue jobs. */
export { handleDueSoonJob } from './deadlineReminders.js'
export const NOTIFICATION_JOB_NAMES = {
  dueSoon: 'notifications.due-soon',
  weeklyDigest: 'notifications.weekly-digest',
  deliverQueued: 'notifications.deliver-queued',
}
// Consume old queued jobs without creating any weekly digests.
export async function handleWeeklyDigestJob(): Promise<void> {}
