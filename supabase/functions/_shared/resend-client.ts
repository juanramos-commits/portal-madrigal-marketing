/**
 * Resend API client for sending plain-text emails.
 *
 * CRITICAL: text-only (no html), no tracking pixel, anti-spam compliant.
 * Supports threading headers (In-Reply-To, References) for follow-ups.
 */

/**
 * Generate a standards-compliant Message-ID for email threading.
 */
export function generateMessageId(domain: string): string {
  const uuid = crypto.randomUUID();
  return `<${uuid}@${domain}>`;
}

interface SendEmailOpts {
  apiKey: string;
  from: string;
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
  inReplyTo?: string;
  references?: string;
  headers?: Record<string, string>;
}

interface SendEmailResult {
  id: string;
  messageId: string;
}

/**
 * Send a plain-text email via the Resend API.
 *
 * @throws {Error} If the API returns a non-2xx response.
 */
export async function sendEmail(opts: SendEmailOpts): Promise<SendEmailResult> {
  const {
    apiKey,
    from,
    to,
    subject,
    text,
    replyTo,
    inReplyTo,
    references,
    headers: extraHeaders,
  } = opts;

  // Extract domain from "from" address for Message-ID generation.
  const domainMatch = from.match(/@([^>]+)>?$/);
  const domain = domainMatch ? domainMatch[1] : "mail.madrigal.marketing";
  const messageId = generateMessageId(domain);

  // Build custom headers for threading and caller-supplied extras.
  const headers: Record<string, string> = {
    "Message-ID": messageId,
    ...extraHeaders,
  };

  if (inReplyTo) {
    headers["In-Reply-To"] = inReplyTo;
  }
  if (references) {
    headers["References"] = references;
  }

  const body: Record<string, unknown> = {
    from,
    to: [to],
    subject,
    text,
    headers,
  };

  if (replyTo) {
    body.reply_to = [replyTo];
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Resend API error ${response.status}: ${errorBody}`,
    );
  }

  const data = await response.json();

  return {
    id: data.id,
    messageId,
  };
}
