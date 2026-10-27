import assert from "node:assert/strict";
import { createServer } from "node:http";
import express from "express";
import { test } from "node:test";
import { createAccessToken } from "../src/auth/accessToken.js";
import { createCashierRouter } from "../src/routes/cashier.js";

const secret = "cashier-route-test-secret-at-least-32-bytes";
const clinicId = "550e8400-e29b-41d4-a716-446655440001";
const cashierId = "550e8400-e29b-41d4-a716-446655440020";
const invoiceId = "550e8400-e29b-41d4-a716-446655440021";
const latestInvoiceId = "550e8400-e29b-41d4-a716-446655440022";
const paymentId = "550e8400-e29b-41d4-a716-446655440023";
const origin = "http://localhost:5173";

function normalize(statement) {
  return statement.replace(/\s+/g, " ").trim().toLowerCase();
}

function authenticatedUser(query) {
  if (query.startsWith("select id, clinic_id, role, is_active, must_change_password from public.users")) {
    return [{ id: cashierId, clinic_id: clinicId, role: "cashier", is_active: true, must_change_password: false }];
  }
  return null;
}

function createCorrectApp({ voidedAt = null, correctedAt = null, latestId = invoiceId } = {}) {
  process.env.AUTH_TOKEN_SECRET = secret;
  const writes = [];
  const execute = async (statement, parameters = []) => {
    const query = normalize(statement);
    const user = authenticatedUser(query);
    if (user) return user;
    if (query.startsWith("select i.payment_id from public.invoices i")) {
      return [{ payment_id: paymentId }];
    }
    if (query.startsWith("select i.id, i.invoice_number, i.payment_id, i.corrected_at, p.voided_at")) {
      return [{
        id: latestId,
        invoice_number: "INV-2026-OLDNUMBER001",
        payment_id: paymentId,
        corrected_at: correctedAt,
        voided_at: voidedAt,
      }];
    }
    if (query.startsWith("update public.invoices")) {
      writes.push({ query, parameters });
      return [{
        id: latestId,
        invoice_number: parameters[0],
        issued_at: "2026-01-01T00:00:00.000Z",
        corrected_at: "2026-01-02T00:00:00.000Z",
        correction_reason: parameters[2],
      }];
    }
    if (query.startsWith("insert into public.audit_logs")) {
      writes.push({ query, parameters });
      return [];
    }
    if (query.startsWith("select coalesce(nullif(concat_ws(' ', sp.first_name")) {
      return [{ name: "Mark Ian Navarro" }];
    }
    throw new Error(`Unexpected test SQL: ${query}`);
  };
  const client = { unsafe: execute, begin: (callback) => callback({ unsafe: execute }) };
  const app = express();
  app.use(express.json());
  app.use("/cashier", createCashierRouter({ client }));
  app.use((error, _req, res, _next) => res.status(500).json({ error: error.message }));
  return { app, writes };
}

async function postJson(app, path, body = {}) {
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const { port } = server.address();
    const token = createAccessToken({
      id: cashierId,
      clinic_id: clinicId,
      role: "cashier",
      must_change_password: false,
    }, secret);
    return await fetch(`http://127.0.0.1:${port}${path}`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, origin, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test("correcting an invoice requires a reason", async () => {
  const { app, writes } = createCorrectApp();
  const response = await postJson(app, `/cashier/invoices/${invoiceId}/correct`, { reason: "   " });
  const payload = await response.json();

  assert.equal(response.status, 400);
  assert.equal(payload.error, "CORRECTION_REASON_REQUIRED");
  assert.equal(writes.length, 0);
});

test("a voided payment cannot be corrected", async () => {
  const { app, writes } = createCorrectApp({ voidedAt: "2026-01-01T00:00:00.000Z" });
  const response = await postJson(app, `/cashier/invoices/${invoiceId}/correct`, { reason: "Wrong patient name" });
  const payload = await response.json();

  assert.equal(response.status, 409);
  assert.equal(payload.error, "INVOICE_NOT_CORRECTABLE");
  assert.match(payload.message, /voided or refunded/);
  assert.equal(writes.length, 0);
});

test("reissuing updates the same invoice row instead of creating a replacement", async () => {
  const { app, writes } = createCorrectApp();
  const response = await postJson(app, `/cashier/invoices/${invoiceId}/correct`, { reason: "Wrong patient name" });
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.data.invoiceId, invoiceId);
  assert.equal(payload.data.previousInvoiceNumber, "INV-2026-OLDNUMBER001");
  assert.match(payload.data.invoiceNumber, /^INV-\d{4}-[0-9A-F]{12}$/);
  assert.equal(payload.data.correctionReason, "Wrong patient name");
  assert.equal(payload.data.correctedBy, "Mark Ian Navarro");
  assert.ok(!writes.some((write) => write.query.includes("insert into public.invoices")));

  const update = writes.find((write) => write.query.includes("update public.invoices"));
  assert.match(update.query, /corrected_invoice_id = null/);
  assert.equal(update.parameters[3], invoiceId);

  const audit = writes.find((write) => write.query.includes("insert into public.audit_logs"));
  assert.equal(audit.parameters[3], "INV-2026-OLDNUMBER001");
  assert.equal(audit.parameters[4], payload.data.invoiceNumber);
  assert.equal(audit.parameters[5], "Wrong patient name");
});

test("an already corrected invoice can be corrected again in place", async () => {
  const { app, writes } = createCorrectApp({ correctedAt: "2026-01-01T00:00:00.000Z" });
  const response = await postJson(app, `/cashier/invoices/${invoiceId}/correct`, { reason: "Amount label was unclear" });
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.data.invoiceId, invoiceId);
  assert.ok(writes.some((write) => write.query.includes("update public.invoices")));
});

test("correcting an older invoice in a legacy chain updates the latest invoice", async () => {
  const { app, writes } = createCorrectApp({ latestId: latestInvoiceId });
  const response = await postJson(app, `/cashier/invoices/${invoiceId}/correct`, { reason: "Clerical error" });
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.data.invoiceId, latestInvoiceId);
  const update = writes.find((write) => write.query.includes("update public.invoices"));
  assert.equal(update.parameters[3], latestInvoiceId);
});
