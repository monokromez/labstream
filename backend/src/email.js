import nodemailer from "nodemailer";

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
}[character]));

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

function createTransport(env, createTransporter) {
  const missing = ["MAIL_HOST", "MAIL_PORT", "MAIL_FROM_ADDRESS"].filter((key) => !env[key]);
  if (missing.length) throw new Error(`Missing mail settings: ${missing.join(", ")}`);
  const port = Number(env.MAIL_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("MAIL_PORT must be a valid TCP port.");

  const scheme = String(env.MAIL_SCHEME ?? "smtp").toLowerCase();
  return {
    from: { name: env.MAIL_FROM_NAME || "Labstream", address: env.MAIL_FROM_ADDRESS },
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

export function createEmailService({
  env = process.env,
  createTransporter = nodemailer.createTransport,
  logger = console,
} = {}) {
  let mailConfiguration;

  async function deliver(event, message) {
    if (!message.to) {
      return { status: "skipped", message: "No recipient email address is on file." };
    }
    try {
      mailConfiguration ??= createTransport(env, createTransporter);
      await mailConfiguration.transporter.sendMail({
        from: mailConfiguration.from,
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
      });
      return { status: "sent", message: "Email sent." };
    } catch (error) {
      logger.error("Email delivery failed.", { event, error: error.message });
      return {
        status: "failed",
        message: "Email delivery failed after the system action completed. Contact the laboratory administrator for help.",
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
        text: `Your ${role} Labstream account is ready. Sign in with account ID ${accountId} and one-time activation code ${code}, then choose your password. This code does not expire and can only be used once.`,
        html: emailFrame(name, `<p>Your ${safeRole} Labstream account is ready.</p>
          <p>Use this account ID and one-time activation code to sign in and choose your password:</p>
          <p><strong>Account ID:</strong> ${safeAccountId}<br><strong>Activation code:</strong> ${safeCode}</p>
          <p>This code does not expire and can only be used once. If you did not expect this account, contact your laboratory administrator.</p>`),
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
