const FAILURE_REASONS = {
  MAIL_NOT_CONFIGURED: 'Email is not configured on the server. Ask the laboratory administrator to configure SMTP.',
  MAIL_PORT_BLOCKED: 'The hosting provider blocked the connection to the mail server. Ask the administrator to use SMTP port 2525 or upgrade the hosting plan.',
  MAIL_CONNECTION_FAILED: 'The mail server could not be reached. Ask the laboratory administrator to check the SMTP host and port.',
  MAIL_AUTH_FAILED: 'The mail server rejected the sign-in. Ask the laboratory administrator to check the SMTP username and password.',
  MAIL_SENDER_REJECTED: 'The mail server rejected the sender address. Ask the administrator to verify the from-address with the email provider.',
  MAIL_RATE_LIMITED: 'The email provider is temporarily rate limiting messages. Wait a few minutes, then try again.',
  MAIL_DELIVERY_FAILED: 'The email could not be delivered. Ask the laboratory administrator to check the mail settings.',
}

/**
 * Turn the API's `emailDelivery` payload into display text.
 * Falls back to the server message when the reason is unknown.
 */
export function describeEmailDelivery(delivery, overrides = {}) {
  if (!delivery) return { tone: 'error', text: 'No email delivery result was returned.' }
  if (delivery.status === 'sent') return { tone: 'success', text: overrides.sent ?? 'Email sent.' }
  if (delivery.status === 'skipped') {
    return { tone: 'info', text: overrides.skipped ?? delivery.message ?? 'No recipient email address is on file.' }
  }
  if (delivery.status === 'failed') {
    return {
      tone: 'error',
      text: FAILURE_REASONS[delivery.reason] ?? overrides.failed ?? delivery.message ?? 'Email delivery failed.',
    }
  }
  return { tone: 'error', text: overrides.failed ?? delivery.message ?? 'Email delivery failed.' }
}
