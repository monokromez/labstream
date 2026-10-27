import assert from "node:assert/strict";
import { createServer } from "node:http";
import express from "express";
import { test } from "node:test";
import { createAccessToken } from "../src/auth/accessToken.js";
import { createTechnologistRouter } from "../src/routes/technologist.js";

const secret = "technologist-route-test-secret-at-least-32-bytes";
const clinicId = "550e8400-e29b-41d4-a716-446655440001";
const technologistId = "550e8400-e29b-41d4-a716-446655440010";
const specimenId = "550e8400-e29b-41d4-a716-446655440011";
const origin = "http://localhost:5173";

function createTestApp({ requestStatus = "processing", specimenStatus = "received" } = {}) {
  process.env.AUTH_TOKEN_SECRET = secret;
  const writes = [];
  const execute = async (statement, parameters = []) => {
    const query = statement.replace(/\s+/g, " ").trim().toLowerCase();
    if (query.startsWith("select id, clinic_id, role, is_active, must_change_password from public.users")) {
      return [{ id: technologistId, clinic_id: clinicId, role: "medical_technologist", is_active: true, must_change_password: false }];
    }
    if (query.startsWith("select s.id, s.request_id, s.status, r.status as request_status")) {
      return [{ id: specimenId, request_id: "550e8400-e29b-41d4-a716-446655440012", status: specimenStatus, request_status: requestStatus }];
    }
    if (query.startsWith("update ") || query.startsWith("insert ")) {
      writes.push({ query, parameters });
      return [{ id: specimenId, status: "accepted" }];
    }
    throw new Error(`Unexpected test SQL: ${query}`);
  };
  const client = { unsafe: execute, begin: (callback) => callback({ unsafe: execute }) };
  const app = express();
  app.use(express.json());
  app.use("/technologist", createTechnologistRouter({ client }));
  app.use((error, _req, res, _next) => res.status(500).json({ error: error.message }));
  return { app, writes };
}

async function acceptSpecimen(app) {
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const { port } = server.address();
    const token = createAccessToken({
      id: technologistId,
      clinic_id: clinicId,
      role: "medical_technologist",
      must_change_password: false,
    }, secret);
    return await fetch(`http://127.0.0.1:${port}/technologist/specimens/${specimenId}/accept`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, origin, "content-type": "application/json" },
      body: "{}",
    });
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test("a specimen on a cancelled request cannot be accepted", async () => {
  const { app, writes } = createTestApp({ requestStatus: "cancelled" });
  const response = await acceptSpecimen(app);
  const payload = await response.json();

  assert.equal(response.status, 409);
  assert.equal(payload.error, "REQUEST_NOT_ACTIVE");
  assert.match(payload.message, /cancelled/);
  assert.equal(writes.length, 0);
});

test("a specimen on a released request cannot be accepted", async () => {
  const { app, writes } = createTestApp({ requestStatus: "released" });
  const response = await acceptSpecimen(app);

  assert.equal(response.status, 409);
  assert.equal(writes.length, 0);
});

test("a specimen on a processing request is accepted and audited", async () => {
  const { app, writes } = createTestApp({ requestStatus: "processing" });
  const response = await acceptSpecimen(app);

  assert.equal(response.status, 200);
  assert.ok(writes.some((write) => write.query.includes("specimen.accepted")));
});
