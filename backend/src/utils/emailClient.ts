/**
 * File: src/utils/emailClient.ts
 * Purpose: Provide a stubbed email sender for notification delivery.
 * Why: Allows notification jobs to exercise the delivery pipeline without a provider.
 */
import { logger } from "../config/logger.js";

type EmailPayload = {
  to: string;
  subject: string;
  bodyText: string;
};

export async function sendNotificationEmail(
  payload: EmailPayload,
): Promise<void> {
  logger.info(
    {
      to: payload.to,
      subject: payload.subject,
    },
    "Stubbed email delivery",
  );
  logger.debug({ bodyText: payload.bodyText }, "Stubbed email body");
}
