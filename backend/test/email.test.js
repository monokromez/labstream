import assert from "node:assert/strict";
import { test } from "node:test";
import { createEmailService } from "../src/email.js";

const mailEnvironment = {
  MAIL_HOST: "smtp.example.test",
  MAIL_PORT: "587",
  MAIL_SCHEME: "smtp",
  MAIL_USERNAME: "mailer",
  MAIL_PASSWORD: "secret",
  MAIL_FROM_ADDRESS: "no-reply@labstream-mail.com",
  MAIL_FROM_NAME: "Labstream Test",
};

test("sends activation, receipt, and released-result emails with escaped content", async () => {
  const messages = [];
  let transportOptions;
  const service = createEmailService({
    env: mailEnvironment,
    createTransporter(options) {
      transportOptions = options;
      return { sendMail: async (message) => messages.push(message) };
    },
  });

  const activation = await service.sendActivationEmail({
    to: "staff@labstream-mail.com",
    name: "<Staff>",
    accountId: "TECH-01",
    code: "<code>",
    role: "medical technologist",
  });
  const receipt = await service.sendPaymentReceiptEmail({
    to: "patient@labstream-mail.com",
    name: "Patient",
    requestNumber: "REQ-01",
    invoiceNumber: "INV-01",
    amount: "125.50",
    paidAt: "2026-10-26T06:00:00.000Z",
    paymentMethod: "cash",
    clinicName: "Labstream Clinic",
  });
  const released = await service.sendResultsReleasedEmail({
    to: "patient@labstream-mail.com",
    name: "Patient",
    requestNumber: "REQ-01",
    clinicName: "Labstream Clinic",
    portalUrl: "https://labstream.example.test",
  });

  assert.deepEqual([activation.status, receipt.status, released.status], ["sent", "sent", "sent"]);
  assert.equal(messages.length, 3);
  assert.equal(messages[0].from.address, "no-reply@labstream-mail.com");
  assert.equal(transportOptions.secure, false);
  assert.match(messages[0].html, /&lt;Staff&gt;/);
  assert.match(messages[0].html, /&lt;code&gt;/);
  assert.match(messages[0].text, /expires in 24 hours and can only be used once/);
  assert.match(messages[1].text, /₱125\.50/);
  assert.match(messages[2].text, /results are not included in email/);
  assert.doesNotMatch(messages[2].text, /test name|result value/i);
});

test("skips email when there is no recipient", async () => {
  let transportCreated = false;
  const service = createEmailService({
    env: mailEnvironment,
    createTransporter() {
      transportCreated = true;
      return { sendMail: async () => {} };
    },
  });

  const result = await service.sendResultsReleasedEmail({
    to: null,
    name: "Patient",
    requestNumber: "REQ-01",
    clinicName: "Labstream Clinic",
    portalUrl: "https://labstream.example.test",
  });

  assert.equal(result.status, "skipped");
  assert.equal(transportCreated, false);
});

test("reports SMTP configuration and delivery failures", async () => {
  const errors = [];
  const service = createEmailService({
    env: { ...mailEnvironment, MAIL_PORT: "invalid" },
    createTransporter() {
      throw new Error("should not be reached");
    },
    logger: { error: (...args) => errors.push(args) },
  });

  const result = await service.sendActivationEmail({
    to: "staff@labstream-mail.com",
    name: "Staff",
    accountId: "TECH-01",
    code: "one-time-code",
    role: "medical technologist",
  });

  assert.equal(result.status, "failed");
  assert.equal(errors.length, 1);

  const failingService = createEmailService({
    env: mailEnvironment,
    createTransporter: () => ({ sendMail: async () => { throw new Error("SMTP unavailable"); } }),
    logger: { error: (...args) => errors.push(args) },
  });
  const failedDelivery = await failingService.sendActivationEmail({
    to: "staff@labstream-mail.com",
    name: "Staff",
    accountId: "TECH-01",
    code: "one-time-code",
    role: "medical technologist",
  });
  assert.equal(failedDelivery.status, "failed");
  assert.equal(errors.length, 2);
});

test("retries on a fallback port when the host blocks SMTP", async () => {
  const attempts = [];
  const messages = [];
  const service = createEmailService({
    env: { ...mailEnvironment, MAIL_PORT: "587", MAIL_FALLBACK_PORT: "2525" },
    createTransporter(options) {
      attempts.push(options.port);
      return {
        sendMail: async (message) => {
          if (options.port === 587) throw Object.assign(new Error("Connection timeout"), { code: "ETIMEDOUT" });
          messages.push(message);
        },
      };
    },
    logger: { error: () => {}, warn: () => {} },
  });

  const receipt = {
    to: "patient@labstream-mail.com",
    name: "Patient",
    requestNumber: "REQ-01",
    invoiceNumber: "INV-01",
    amount: "125.50",
    paidAt: "2026-10-26T06:00:00.000Z",
    paymentMethod: "cash",
    clinicName: "Labstream Clinic",
  };

  assert.equal((await service.sendPaymentReceiptEmail(receipt)).status, "sent");
  assert.deepEqual(attempts, [587, 2525]);
  assert.equal(messages.length, 1);

  // The working fallback transport is reused by later messages.
  assert.equal((await service.sendPaymentReceiptEmail(receipt)).status, "sent");
  assert.deepEqual(attempts, [587, 2525]);
});

test("reports a blocked port when the primary and fallback connections both fail", async () => {
  const service = createEmailService({
    env: { ...mailEnvironment, MAIL_PORT: "587" },
    createTransporter: () => ({
      sendMail: async () => { throw Object.assign(new Error("connect ETIMEDOUT"), { code: "ETIMEDOUT" }); },
    }),
    logger: { error: () => {}, warn: () => {} },
  });

  const result = await service.sendPaymentReceiptEmail({
    to: "patient@labstream-mail.com",
    name: "Patient",
    requestNumber: "REQ-01",
    invoiceNumber: "INV-01",
    amount: "125.50",
    paidAt: "2026-10-26T06:00:00.000Z",
    paymentMethod: "cash",
    clinicName: "Labstream Clinic",
  });

  assert.equal(result.status, "failed");
  assert.equal(result.reason, "MAIL_PORT_BLOCKED");
  assert.match(result.message, /2525|hosting/i);
});

test("classifies authentication and sender failures without leaking secrets", async () => {
  const authService = createEmailService({
    env: mailEnvironment,
    createTransporter: () => ({
      sendMail: async () => { throw Object.assign(new Error("Invalid login: 535 auth failed"), { code: "EAUTH", responseCode: 535 }); },
    }),
    logger: { error: () => {}, warn: () => {} },
  });
  const authResult = await authService.sendActivationEmail({
    to: "staff@labstream-mail.com",
    name: "Staff",
    accountId: "TECH-01",
    code: "one-time-code",
    role: "medical technologist",
  });
  assert.equal(authResult.reason, "MAIL_AUTH_FAILED");
  assert.doesNotMatch(authResult.message, /secret/i);

  const senderService = createEmailService({
    env: mailEnvironment,
    createTransporter: () => ({
      sendMail: async () => { throw Object.assign(new Error("Sender not verified"), { responseCode: 550 }); },
    }),
    logger: { error: () => {}, warn: () => {} },
  });
  const senderResult = await senderService.sendPaymentReceiptEmail({
    to: "patient@labstream-mail.com",
    name: "Patient",
    requestNumber: "REQ-01",
    invoiceNumber: "INV-01",
    amount: "125.50",
    paidAt: "2026-10-26T06:00:00.000Z",
    paymentMethod: "cash",
    clinicName: "Labstream Clinic",
  });
  assert.equal(senderResult.reason, "MAIL_SENDER_REJECTED");
});

test("sends an administrator test email through the relay", async () => {
  const messages = [];
  const service = createEmailService({
    env: mailEnvironment,
    createTransporter: () => ({ sendMail: async (message) => messages.push(message) }),
  });

  const result = await service.sendTestEmail({ to: "admin@labstream-mail.com", name: "Admin" });

  assert.equal(result.status, "sent");
  assert.equal(messages.length, 1);
  assert.equal(messages[0].to, "admin@labstream-mail.com");
  assert.match(messages[0].subject, /test email/i);
  assert.match(messages[0].html, /relay is configured correctly/i);
});

test("skips placeholder recipients instead of reporting a successful send", async () => {
  let transportCreated = false;
  const service = createEmailService({
    env: mailEnvironment,
    createTransporter() {
      transportCreated = true;
      return { sendMail: async () => {} };
    },
  });

  const result = await service.sendTestEmail({ to: "admin@labstream-demo.test", name: "Admin" });

  assert.equal(result.status, "skipped");
  assert.equal(result.reason, "NO_DELIVERABLE_RECIPIENT");
  assert.match(result.message, /placeholder/i);
  assert.equal(transportCreated, false);
});

test("returns the relay message id so a provider log can be matched", async () => {
  const service = createEmailService({
    env: mailEnvironment,
    createTransporter: () => ({
      sendMail: async () => ({ messageId: "<abc123@smtp-relay.brevo.com>", response: "250 OK queued", accepted: ["patient@labstream-mail.com"], rejected: [] }),
    }),
    logger: { info: () => {}, warn: () => {} },
  });

  const result = await service.sendResultsReleasedEmail({
    to: "patient@labstream-mail.com",
    name: "Patient",
    requestNumber: "REQ-01",
    clinicName: "Labstream Clinic",
    portalUrl: "https://labstream.example.test",
  });

  assert.equal(result.status, "sent");
  assert.equal(result.messageId, "<abc123@smtp-relay.brevo.com>");
});

test("reports a rejected recipient", async () => {
  const service = createEmailService({
    env: mailEnvironment,
    createTransporter: () => ({
      sendMail: async () => ({ accepted: [], rejected: ["patient@labstream-mail.com"], response: "250 OK" }),
    }),
    logger: { error: () => {}, warn: () => {} },
  });

  const result = await service.sendActivationEmail({
    to: "patient@labstream-mail.com",
    name: "Patient",
    accountId: "PID-1",
    code: "code",
    role: "patient",
  });

  assert.equal(result.status, "failed");
  assert.equal(result.reason, "MAIL_RECIPIENT_REJECTED");
});
