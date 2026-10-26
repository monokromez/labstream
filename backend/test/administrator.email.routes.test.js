import assert from "node:assert/strict";
import { createServer } from "node:http";
import express from "express";
import { test } from "node:test";
import { createAccessToken } from "../src/auth/accessToken.js";
import { createAdministratorRouter } from "../src/routes/administrator.js";

const secret = "administrator-email-test-secret-at-least-32-bytes";
const clinicId = "550e8400-e29b-41d4-a716-446655440011";
const adminId = "550e8400-e29b-41d4-a716-446655440012";
const origin = "http://localhost:5173";

function createTestApp() {
  process.env.AUTH_TOKEN_SECRET = secret;
  const writes = [];
  const client = {
    unsafe: async (statement, parameters = []) => {
      const query = statement.replace(/\s+/g, " ").trim().toLowerCase();
      if (query.startsWith("select id, clinic_id, role, is_active, must_change_password from public.users")) {
        return [{ id: adminId, clinic_id: clinicId, role: "administrator", is_active: true, must_change_password: false }];
      }
      if (query.startsWith("select u.email, concat_ws")) {
        return [{ email: "admin@example.test", name: "Admin User" }];
      }
      if (query.startsWith("insert into public.audit_logs")) {
        writes.push({ query, parameters });
        return [];
      }
      throw new Error(`Unexpected test SQL: ${query}`);
    },
  };
  const app = express();
  app.use(express.json());
  app.use("/admin", createAdministratorRouter({ client }));
  app.use((error, _req, res, _next) => res.status(500).json({ error: error.message }));
  return { app, writes };
}

async function postEmailTest(app, body) {
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const { port } = server.address();
    const token = createAccessToken({
      id: adminId,
      clinic_id: clinicId,
      role: "administrator",
      must_change_password: false,
    }, secret);
    return await fetch(`http://127.0.0.1:${port}/admin/email-test`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        origin,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

function withoutMailSettings() {
  const saved = {};
  for (const key of ["MAIL_HOST", "MAIL_PORT", "MAIL_FROM_ADDRESS", "MAIL_FROM_NAME", "MAIL_USERNAME", "MAIL_PASSWORD", "MAIL_SCHEME"]) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
  return () => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  };
}

test("admin test email reports a missing mail configuration without failing the request", async () => {
  const restore = withoutMailSettings();
  try {
    const { app, writes } = createTestApp();
    const response = await postEmailTest(app, {});
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.data.to, "admin@example.test");
    assert.equal(payload.emailDelivery.status, "failed");
    assert.equal(payload.emailDelivery.reason, "MAIL_NOT_CONFIGURED");
    assert.equal(payload.mail.configured, false);
    assert.equal(writes.length, 1);
    assert.match(writes[0].query, /email\.test_sent/);
    assert.equal(writes[0].parameters[3], "failed");
  } finally {
    restore();
  }
});

test("admin test email rejects an invalid recipient before sending", async () => {
  const { app, writes } = createTestApp();
  const response = await postEmailTest(app, { to: "not-an-email" });
  const payload = await response.json();

  assert.equal(response.status, 400);
  assert.equal(payload.error, "INVALID_EMAIL");
  assert.equal(writes.length, 0);
});
