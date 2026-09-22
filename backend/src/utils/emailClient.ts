/**
 * File: src/utils/emailClient.ts
 * Purpose: Send transactional notification emails via Brevo.
 * Why: Delivers queued email notifications using the configured provider.
 */
import { config } from "../config/env.js";
import { logger } from "../config/logger.js";

type EmailPayload = {
  to: string;
  toName?: string;
  subject: string;
  bodyText: string;
};

// A rejected HTTP request is retryable; a lost response may already have delivered mail.
export class EmailDeliveryUncertainError extends Error {}

export async function sendNotificationEmail(
  payload: EmailPayload,
): Promise<void> {
  const body = {
    sender: {
      name: config.email.senderName,
      email: config.email.senderEmail,
    },
    to: [
      {
        email: payload.to,
        name: payload.toName,
      },
    ],
    subject: payload.subject,
    textContent: payload.bodyText,
  };

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": config.email.brevoApiKey,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify(body),
  }).catch(() => {
    throw new EmailDeliveryUncertainError("Email provider response unavailable");
  });

  if (!response.ok) {
    if (response.status >= 500) {
      throw new EmailDeliveryUncertainError("Email provider outcome uncertain");
    }
    const errorBody = await response.text();
    logger.error(
      {
        status: response.status,
        response: errorBody,
        to: payload.to,
      },
      "Brevo email delivery failed",
    );
    throw new Error("Brevo email delivery failed");
  }

  logger.info(
    {
      to: payload.to,
      subject: payload.subject,
    },
    "Brevo email accepted",
  );
}
