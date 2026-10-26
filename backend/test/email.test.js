import assert from "node:assert/strict";
import { test } from "node:test";
import { createEmailService } from "../src/email.js";

const mailEnvironment = {
  MAIL_HOST: "smtp.example.test",
  MAIL_PORT: "587",
  MAIL_SCHEME: "smtp",
  MAIL_USERNAME: "mailer",
  MAIL_PASSWORD: "secret",
  MAIL_FROM_ADDRESS: "no-reply@example.test",
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
    to: "staff@example.test",
    name: "<Staff>",
    accountId: "TECH-01",
    code: "<code>",
    role: "medical technologist",
  });
  const receipt = await service.sendPaymentReceiptEmail({
    to: "patient@example.test",
    name: "Patient",
    requestNumber: "REQ-01",
    invoiceNumber: "INV-01",
    amount: "125.50",
    paidAt: "2026-10-26T06:00:00.000Z",
    paymentMethod: "cash",
    clinicName: "Labstream Clinic",
  });
  const released = await service.sendResultsReleasedEmail({
    to: "patient@example.test",
    name: "Patient",
    requestNumber: "REQ-01",
    clinicName: "Labstream Clinic",
    portalUrl: "https://labstream.example.test",
  });

  assert.deepEqual([activation.status, receipt.status, released.status], ["sent", "sent", "sent"]);
  assert.equal(messages.length, 3);
  assert.equal(messages[0].from.address, "no-reply@example.test");
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
    to: "staff@example.test",
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
    to: "staff@example.test",
    name: "Staff",
    accountId: "TECH-01",
    code: "one-time-code",
    role: "medical technologist",
  });
  assert.equal(failedDelivery.status, "failed");
  assert.equal(errors.length, 2);
});
