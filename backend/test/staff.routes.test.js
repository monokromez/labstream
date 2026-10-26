import assert from "node:assert/strict";
import { createServer } from "node:http";
import express from "express";
import { test } from "node:test";
import { createAccessToken } from "../src/auth/accessToken.js";
import { createStaffRouter } from "../src/routes/staff.js";

const secret = "staff-route-test-secret-that-is-at-least-32-bytes";
const clinicId = "550e8400-e29b-41d4-a716-446655440001";
const adminId = "550e8400-e29b-41d4-a716-446655440002";
const staffId = "550e8400-e29b-41d4-a716-446655440003";
const origin = "http://localhost:5173";

function createTestApp({ role = "cashier", isActive = false, isPendingActivation = false, hasActiveWork = false } = {}) {
  process.env.AUTH_TOKEN_SECRET = secret;
  const writes = [];
  const target = {
    id: staffId,
    username: "CSH-000003",
    role,
    is_active: isActive,
    password_hash: isPendingActivation ? null : "activated-password-hash",
  };
  const execute = async (statement, parameters = []) => {
    const query = statement.replace(/\s+/g, " ").trim().toLowerCase();
    if (query.startsWith("select id, clinic_id, role, is_active, must_change_password from public.users")) {
      return [{ id: adminId, clinic_id: clinicId, role: "administrator", is_active: true, must_change_password: false }];
    }
    if (query.startsWith("select id, username, role, is_active, password_hash from public.users")) return [target];
    if (query.startsWith("select exists(")) return [{ has_active_work: hasActiveWork }];
    if (query.startsWith("update public.users set email =")) {
      writes.push({ query, parameters });
      target.role = parameters[1];
      target.username = `NEW-${target.role.toUpperCase()}`;
      return [{ id: target.id, username: target.username, role: target.role }];
    }
    if (query.startsWith("update public.staff_profiles")) {
      writes.push({ query, parameters });
      return [{ user_id: target.id }];
    }
    if (query.startsWith("insert into public.audit_logs")) {
      writes.push({ query, parameters });
      return [];
    }
    throw new Error(`Unexpected test SQL: ${query}`);
  };
  const client = {
    unsafe: execute,
    begin: (callback) => callback({ unsafe: execute }),
  };
  const app = express();
  app.use(express.json());
  app.use("/staff", createStaffRouter({ client }));
  app.use((error, _req, res, _next) => res.status(500).json({ error: error.message }));
  return { app, writes };
}

async function patchStaff(app, role) {
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
    return await fetch(`http://127.0.0.1:${port}/staff/${staffId}`, {
      method: "PATCH",
      headers: {
        authorization: `Bearer ${token}`,
        origin,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        role,
        firstName: "Alex",
        middleName: null,
        lastName: "Rivera",
        dateOfBirth: "1990-05-20",
        phone: "+14155552671",
        countryCode: "US",
        email: "alex.rivera@gmail.com",
        country: "United States",
        city: "San Francisco",
        houseNumber: "12",
        street: "Market Street",
      }),
    });
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test("role change updates the role, username, profile, and audit event atomically", async () => {
  const { app, writes } = createTestApp();
  const response = await patchStaff(app, "pathologist");
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(payload.data, {
    id: staffId,
    role: "pathologist",
    username: "NEW-PATHOLOGIST",
    roleChanged: true,
  });
  assert.equal(writes.length, 3);
  assert.equal(writes[2].parameters[2], "staff.role_changed");
});

test("role changes are rejected for active accounts without writing", async () => {
  const { app, writes } = createTestApp({ isActive: true });
  const response = await patchStaff(app, "pathologist");
  const payload = await response.json();

  assert.equal(response.status, 409);
  assert.equal(payload.error, "STAFF_ROLE_CHANGE_REQUIRES_INACTIVE");
  assert.equal(writes.length, 0);
});

test("role changes are rejected while active work remains assigned", async () => {
  const { app, writes } = createTestApp({ role: "pathologist", hasActiveWork: true });
  const response = await patchStaff(app, "medical_technologist");
  const payload = await response.json();

  assert.equal(response.status, 409);
  assert.equal(payload.error, "STAFF_ROLE_CHANGE_HAS_ACTIVE_WORK");
  assert.equal(writes.length, 0);
});
