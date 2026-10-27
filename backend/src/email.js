import nodemailer from "nodemailer";

// SMTP ports that Render (and some other PaaS hosts) block for outbound mail.
// Render's free web services cannot connect to 25, 465, or 587.
const BLOCKED_SMTP_PORTS = new Set([25, 465, 587]);
const DEFAULT_FALLBACK_PORT = 2525;

const DELIVERY_MESSAGES = {
  NO_RECIPIENT: "No recipient email address is on file.",
  NO_DELIVERABLE_RECIPIENT: "The recipient address is a placeholder (such as admin@labstream-demo.test) and cannot receive mail. Use a real address.",
  MAIL_NOT_CONFIGURED: "Email is not configured on the server. Ask the laboratory administrator to set MAIL_HOST, MAIL_PORT, and MAIL_FROM_ADDRESS.",
  MAIL_PORT_BLOCKED: "The hosting provider blocked the connection to the mail server. Ask the administrator to set MAIL_PORT=2525 (or MAIL_FALLBACK_PORT=2525) or to upgrade the hosting plan.",
  MAIL_CONNECTION_FAILED: "The mail server could not be reached. Ask the laboratory administrator to check MAIL_HOST and MAIL_PORT.",
  MAIL_AUTH_FAILED: "The mail server rejected the sign-in. Ask the laboratory administrator to check the SMTP username and password.",
  MAIL_SENDER_REJECTED: "The mail server rejected the sender address. Ask the administrator to verify MAIL_FROM_ADDRESS with the email provider.",
  MAIL_RATE_LIMITED: "The email provider is temporarily rate limiting messages. Wait a few minutes, then try again.",
  MAIL_RECIPIENT_REJECTED: "The mail server rejected the recipient address. Check the address for typos, then try again.",
  MAIL_DELIVERY_FAILED: "Email delivery failed after the system action completed. Contact the laboratory administrator for help.",
};

class MailConfigurationError extends Error {}

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
}[character]));

// RFC 2606 reserved names never resolve to a real mailbox. The seeded
// administrator is admin@labstream-demo.test, so a send to it would otherwise
// be accepted by the relay and silently bounce.
const PLACEHOLDER_DOMAINS = new Set(["example.com", "example.net", "example.org", "localhost"]);
const PLACEHOLDER_SUFFIXES = [".test", ".invalid", ".example", ".localhost"];

export function isUndeliverableRecipient(address) {
  const domain = String(address ?? "").split("@")[1]?.trim().toLowerCase() ?? "";
  if (!domain) return true;
  return PLACEHOLDER_DOMAINS.has(domain) || PLACEHOLDER_SUFFIXES.some((suffix) => domain.endsWith(suffix));
}

const recipientDomain = (address) => String(address ?? "").split("@")[1]?.trim().toLowerCase() ?? "";

const emailFrame = (name, content) => `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#f3f7f6;color:#183c3a;font:16px Arial,sans-serif">
    <main style="max-width:600px;margin:32px auto;padding:32px;background:#fff;border-radius:12px">
      <p style="color:#087f73;font-weight:700">Labstream</p>
      <p>Hello ${escapeHtml(name)},</p>
      ${content}
      <p style="color:#647976;font-size:13px">This is an automated message from Labstream. Please do not reply.</p>
    </main>
  </body>
</html>`;

function readMailSettings(env) {
  const missing = ["MAIL_HOST", "MAIL_PORT", "MAIL_FROM_ADDRESS"].filter((key) => !env[key]);
  if (missing.length) throw new MailConfigurationError(`Missing mail settings: ${missing.join(", ")}`);
  const configuredPort = Number(env.MAIL_PORT);
  if (!Number.isInteger(configuredPort) || configuredPort < 1 || configuredPort > 65535) {
    throw new MailConfigurationError("MAIL_PORT must be a valid TCP port.");
  }
  return {
    from: { name: env.MAIL_FROM_NAME || "Labstream", address: env.MAIL_FROM_ADDRESS },
    configuredPort,
  };
}

export function describeMailConfiguration(env = process.env) {
  let settings;
  try {
    settings = readMailSettings(env);
  } catch (error) {
    return {
      configured: false,
      missing: ["MAIL_HOST", "MAIL_PORT", "MAIL_FROM_ADDRESS"].filter((key) => !env[key]),
      port: Number(env.MAIL_PORT) || null,
      blockedPort: false,
      message: error.message,
    };
  }
  const fallbackPort = Number(env.MAIL_FALLBACK_PORT ?? DEFAULT_FALLBACK_PORT);
  return {
    configured: true,
    missing: [],
    host: env.MAIL_HOST,
    port: settings.configuredPort,
    blockedPort: BLOCKED_SMTP_PORTS.has(settings.configuredPort),
    fallbackPort: Number.isInteger(fallbackPort) && fallbackPort > 0 ? fallbackPort : null,
    onRender: String(env.RENDER ?? "").toLowerCase() === "true",
    message: "Mail settings are present.",
  };
}

/** Map a transport failure onto a stable, non-sensitive reason code. */
export function classifyDeliveryFailure(error) {
  const code = String(error?.code ?? "");
  const responseCode = Number(error?.responseCode);
  const message = String(error?.message ?? "");
  if (code === "EAUTH" || [530, 534, 535, 536].includes(responseCode)) return "MAIL_AUTH_FAILED";
  if ([550, 553, 554].includes(responseCode)) return "MAIL_SENDER_REJECTED";
  if ([421, 450, 451, 452].includes(responseCode) || /rate.?limit|too many/i.test(message)) return "MAIL_RATE_LIMITED";
  if (["ETIMEDOUT", "ECONNREFUSED", "ESOCKET", "EHOSTUNREACH", "ENETUNREACH", "EAI_AGAIN", "ECONNRESET"].includes(code)) {
    return "MAIL_CONNECTION_FAILED";
  }
  return "MAIL_DELIVERY_FAILED";
}

export function createEmailService({
  env = process.env,
  createTransporter = nodemailer.createTransport,
  logger = console,
} = {}) {
  let mailConfiguration;

  function connect(port) {
    const scheme = String(env.MAIL_SCHEME ?? "smtp").toLowerCase();
    return {
      from: { name: env.MAIL_FROM_NAME || "Labstream", address: env.MAIL_FROM_ADDRESS },
      port,
      transporter: createTransporter({
        host: env.MAIL_HOST,
        port,
        secure: scheme === "smtps" || scheme === "ssl" || port === 465,
        auth: env.MAIL_USERNAME || env.MAIL_PASSWORD
          ? { user: env.MAIL_USERNAME, pass: env.MAIL_PASSWORD }
          : undefined,
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 20_000,
      }),
    };
  }

  function primaryConfiguration() {
    if (!mailConfiguration) {
      const { configuredPort } = readMailSettings(env);
      mailConfiguration = connect(configuredPort);
    }
    return mailConfiguration;
  }

  function fallbackPort(port) {
    if (!BLOCKED_SMTP_PORTS.has(port)) return null;
    const configured = Number(env.MAIL_FALLBACK_PORT ?? DEFAULT_FALLBACK_PORT);
    if (!Number.isInteger(configured) || configured < 1 || configured > 65535 || configured === port) return null;
    return configured;
  }

  async function sendWithFallback(message) {
    const primary = primaryConfiguration();
    try {
      return await primary.transporter.sendMail(message);
    } catch (error) {
      const reason = classifyDeliveryFailure(error);
      const retryPort = reason === "MAIL_CONNECTION_FAILED" ? fallbackPort(primary.port) : null;
      if (!retryPort) throw Object.assign(error, { deliveryReason: reason });

      // Hosts such as Render block SMTP on 25/465/587. Retry once on the
      // provider's alternate submission port before reporting a failure.
      logger.warn?.(`Mail server on port ${primary.port} was unreachable; retrying on port ${retryPort}.`);
      const fallback = connect(retryPort);
      try {
        const info = await fallback.transporter.sendMail(message);
        mailConfiguration = fallback;
        logger.warn?.(`Mail relay switched to fallback port ${retryPort}. Set MAIL_PORT=${retryPort} to skip this retry.`);
        return info;
      } catch (fallbackError) {
        const fallbackReason = classifyDeliveryFailure(fallbackError);
        throw Object.assign(fallbackError, {
          deliveryReason: fallbackReason === "MAIL_CONNECTION_FAILED" ? "MAIL_PORT_BLOCKED" : fallbackReason,
        });
      }
    }
  }

  async function deliver(event, message) {
    if (!message.to) {
      return { status: "skipped", reason: "NO_RECIPIENT", message: DELIVERY_MESSAGES.NO_RECIPIENT };
    }
    if (isUndeliverableRecipient(message.to)) {
      logger.warn?.("Email skipped: recipient uses a placeholder domain.", { event, domain: recipientDomain(message.to) });
      return { status: "skipped", reason: "NO_DELIVERABLE_RECIPIENT", message: DELIVERY_MESSAGES.NO_DELIVERABLE_RECIPIENT };
    }
    try {
      const info = await sendWithFallback({
        from: mailConfiguration?.from ?? readMailSettings(env).from,
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
      });
      const rejected = Array.isArray(info?.rejected) ? info.rejected : [];
      if (rejected.length) {
        logger.error("Email recipient was rejected by the mail relay.", { event, domain: recipientDomain(message.to), rejected });
        return { status: "failed", reason: "MAIL_RECIPIENT_REJECTED", message: DELIVERY_MESSAGES.MAIL_RECIPIENT_REJECTED };
      }
      // "sent" means the relay accepted the message; it is not proof of inbox
      // delivery. Log the relay id so a provider log entry can be matched.
      logger.info?.("Email accepted by the mail relay.", {
        event,
        domain: recipientDomain(message.to),
        messageId: info?.messageId,
        response: info?.response,
      });
      return {
        status: "sent",
        message: "Email accepted by the mail server.",
        ...(info?.messageId ? { messageId: info.messageId } : {}),
      };
    } catch (error) {
      const reason = error.deliveryReason
        ?? (error instanceof MailConfigurationError ? "MAIL_NOT_CONFIGURED" : classifyDeliveryFailure(error));
      logger.error("Email delivery failed.", {
        event,
        reason,
        port: mailConfiguration?.port,
        domain: recipientDomain(message.to),
        code: error.code,
        responseCode: error.responseCode,
        error: error.message,
      });
      return {
        status: "failed",
        reason,
        message: DELIVERY_MESSAGES[reason] ?? DELIVERY_MESSAGES.MAIL_DELIVERY_FAILED,
      };
    }
  }

  return {
    sendActivationEmail({ to, name, accountId, code, role }) {
      const safeCode = escapeHtml(code);
      const safeAccountId = escapeHtml(accountId);
      const safeRole = escapeHtml(role);
      return deliver("account_activation", {
        to,
        subject: "Activate your Labstream account",
        text: `Your ${role} Labstream account is ready. Sign in with account ID ${accountId} and one-time activation code ${code}, then choose your password. This code expires in 24 hours and can only be used once.`,
        html: emailFrame(name, `<p>Your ${safeRole} Labstream account is ready.</p>
          <p>Use this account ID and one-time activation code to sign in and choose your password:</p>
          <p><strong>Account ID:</strong> ${safeAccountId}<br><strong>Activation code:</strong> ${safeCode}</p>
          <p>This code expires in 24 hours and can only be used once. If you did not expect this account, contact your laboratory administrator.</p>`),
      });
    },

    sendPasswordResetEmail({ to, name, pid, code }) {
      const safePid = escapeHtml(pid);
      const safeCode = escapeHtml(code);
      return deliver("patient_password_reset", {
        to,
        subject: "Your Labstream password reset code",
        text: `A cashier issued a password reset for your Labstream patient account. PID: ${pid}. Reset code: ${code}. It expires in 24 hours and can only be used once. If you did not request this, contact the laboratory.`,
        html: emailFrame(name, `<p>A cashier issued a password reset for your Labstream patient account.</p>
          <p><strong>PID:</strong> ${safePid}<br><strong>Reset code:</strong> ${safeCode}</p>
          <p>This code expires in 24 hours and can only be used once. If you did not request this, contact the laboratory.</p>`),
      });
    },

    sendPaymentReceiptEmail({ to, name, requestNumber, invoiceNumber, amount, paidAt, paymentMethod, clinicName }) {
      const formattedAmount = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(Number(amount));
      const paidDate = new Date(paidAt).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" });
      const safeClinicName = escapeHtml(clinicName || "your laboratory");
      const safeRequestNumber = escapeHtml(requestNumber);
      const safeInvoiceNumber = escapeHtml(invoiceNumber);
      const safePaymentMethod = escapeHtml(paymentMethod);
      return deliver("payment_receipt", {
        to,
        subject: `Labstream payment receipt ${invoiceNumber}`,
        text: `Payment recorded by ${clinicName || "your laboratory"}.\nInvoice: ${invoiceNumber}\nRequest: ${requestNumber}\nAmount: ${formattedAmount}\nPayment method: ${paymentMethod}\nDate: ${paidDate}\n\nKeep this message for your records. No test results are included in email.`,
        html: emailFrame(name, `<p>Payment was recorded by ${safeClinicName}.</p>
          <p><strong>Invoice:</strong> ${safeInvoiceNumber}<br><strong>Request:</strong> ${safeRequestNumber}<br>
          <strong>Amount:</strong> ${escapeHtml(formattedAmount)}<br><strong>Method:</strong> ${safePaymentMethod}<br>
          <strong>Date:</strong> ${escapeHtml(paidDate)}</p><p>Keep this message for your records. No test results are included in email.</p>`),
      });
    },

    sendResultsReleasedEmail({ to, name, requestNumber, clinicName, portalUrl }) {
      const safeRequestNumber = escapeHtml(requestNumber);
      const safeClinicName = escapeHtml(clinicName || "your laboratory");
      const safePortalUrl = escapeHtml(portalUrl);
      return deliver("results_released", {
        to,
        subject: `Your results are ready — ${requestNumber}`,
        text: `${clinicName || "Your laboratory"} has released the results for request ${requestNumber}. Sign in to the Labstream patient portal to view them: ${portalUrl}\n\nFor your privacy, results are not included in email.`,
        html: emailFrame(name, `<p>${safeClinicName} has released the results for request <strong>${safeRequestNumber}</strong>.</p>
          <p>Sign in to the Labstream patient portal to view them:</p>
          <p><a href="${safePortalUrl}" style="color:#087f73">Open Labstream</a></p>
          <p>For your privacy, results are not included in email.</p>`),
      });
    },
  };
}

export const emailService = createEmailService();
