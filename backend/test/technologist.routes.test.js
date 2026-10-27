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
const requestId = "550e8400-e29b-41d4-a716-446655440012";
const itemId = "550e8400-e29b-41d4-a716-446655440013";
const submissionId = "550e8400-e29b-41d4-a716-446655440014";
const pathologistId = "550e8400-e29b-41d4-a716-446655440015";
const testId = "550e8400-e29b-41d4-a716-446655440016";
const analyteId = "550e8400-e29b-41d4-a716-446655440017";
const origin = "http://localhost:5173";

function normalize(statement) {
  return statement.replace(/\s+/g, " ").trim().toLowerCase();
}

function authenticatedUser(query) {
  if (query.startsWith("select id, clinic_id, role, is_active, must_change_password from public.users")) {
    return [{ id: technologistId, clinic_id: clinicId, role: "medical_technologist", is_active: true, must_change_password: false }];
  }
  return null;
}

function createTestApp({ requestStatus = "processing", specimenStatus = "received" } = {}) {
  process.env.AUTH_TOKEN_SECRET = secret;
  const writes = [];
  const execute = async (statement, parameters = []) => {
    const query = normalize(statement);
    const user = authenticatedUser(query);
    if (user) return user;
    if (query.startsWith("select s.id, s.request_id, s.status, r.status as request_status")) {
      return [{ id: specimenId, request_id: requestId, status: specimenStatus, request_status: requestStatus }];
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

function createSubmissionApp({ requestStatus = "processing", remainingCount = 0 } = {}) {
  process.env.AUTH_TOKEN_SECRET = secret;
  const writes = [];
  const execute = async (statement, parameters = []) => {
    const query = normalize(statement);
    const user = authenticatedUser(query);
    if (user) return user;
    if (query.startsWith("select id, status, assigned_pathologist_id from public.test_requests")) {
      return [{ id: requestId, status: requestStatus, assigned_pathologist_id: null }];
    }
    if (query.startsWith("select count(*)::integer as total from public.request_items ri")) return [{ total: 1 }];
    if (query.startsWith("select ri.id as item_id, rs.id as submission_id")) {
      return [{ item_id: itemId, submission_id: submissionId, revision_number: 1 }];
    }
    if (query.startsWith("select ri.id, count(a.id)::integer as required_count")) return [];
    if (query.startsWith("select count(*)::integer as total from public.request_items where")) return [{ total: remainingCount }];
    if (query.startsWith("select id from public.users where id = $1")) return [{ id: pathologistId }];
    if (query.startsWith("select u.id from public.users u")) return [{ id: pathologistId }];
    if (query.startsWith("update ") || query.startsWith("insert ")) {
      writes.push({ query, parameters });
      return [{ id: submissionId }];
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

function createDraftApp({ requestStatus = "specimen_collection" } = {}) {
  process.env.AUTH_TOKEN_SECRET = secret;
  const writes = [];
  const execute = async (statement, parameters = []) => {
    const query = normalize(statement);
    const user = authenticatedUser(query);
    if (user) return user;
    if (query.startsWith("select r.id as request_id, r.status as request_status")) {
      return [{
        request_id: requestId, request_status: requestStatus, assigned_technologist_id: technologistId,
        item_id: itemId, test_id: testId, configuration_version: 1, item_status: "drafted",
        date_of_birth: "1990-01-01", sex: "female",
      }];
    }
    if (query.startsWith("select s.id, s.specimen_type from public.specimens")) return [{ id: specimenId, specimen_type: "Whole blood" }];
    if (query.startsWith("select sr.specimen_type from public.test_specimen_requirements")) return [];
    if (query.startsWith("select a.id, a.value_type::text as value_type")) {
      return [{ id: analyteId, value_type: "numeric", options: [], unit: "g/dL", lower_limit: null, upper_limit: null, result_unit: "g/dL", is_required: true }];
    }
    if (query.startsWith("select id, revision_number, status from public.result_submissions")) return [];
    if (query.startsWith("insert into public.result_submissions")) {
      writes.push({ query, parameters });
      return [{ id: submissionId, revision_number: 1 }];
    }
    if (query.startsWith("update ") || query.startsWith("insert ")) {
      writes.push({ query, parameters });
      return [];
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

async function postJson(app, path, body = {}) {
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
    return await fetch(`http://127.0.0.1:${port}${path}`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, origin, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test("a specimen on a cancelled request cannot be accepted", async () => {
  const { app, writes } = createTestApp({ requestStatus: "cancelled" });
  const response = await postJson(app, `/technologist/specimens/${specimenId}/accept`);
  const payload = await response.json();

  assert.equal(response.status, 409);
  assert.equal(payload.error, "REQUEST_NOT_ACTIVE");
  assert.match(payload.message, /cancelled/);
  assert.equal(writes.length, 0);
});

test("a specimen on a released request cannot be accepted", async () => {
  const { app, writes } = createTestApp({ requestStatus: "released" });
  const response = await postJson(app, `/technologist/specimens/${specimenId}/accept`);

  assert.equal(response.status, 409);
  assert.equal(writes.length, 0);
});

test("a specimen on a processing request is accepted and audited", async () => {
  const { app, writes } = createTestApp({ requestStatus: "processing" });
  const response = await postJson(app, `/technologist/specimens/${specimenId}/accept`);

  assert.equal(response.status, 200);
  assert.ok(writes.some((write) => write.query.includes("specimen.accepted")));
});

test("accepting a recollection specimen returns its test to result entry", async () => {
  const { app, writes } = createTestApp({ requestStatus: "specimen_collection", specimenStatus: "for_recollection" });
  const response = await postJson(app, `/technologist/specimens/${specimenId}/accept`);

  assert.equal(response.status, 200);
  assert.ok(writes.some((write) => write.query.includes("update public.request_items ri set status = 'processing'")));
});

test("a draft can be saved while other specimens are still expected", async () => {
  const { app, writes } = createDraftApp({ requestStatus: "specimen_collection" });
  const response = await postJson(app, `/technologist/requests/${requestId}/items/${itemId}/draft`, {
    specimenIds: [specimenId],
    values: [{ analyteId, numericValue: 12 }],
  });
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.data.status, "draft");
  assert.ok(writes.some((write) => write.query.includes("results.draft_saved")));
});

test("submitting while a test still needs recollection leaves the request active", async () => {
  const { app, writes } = createSubmissionApp({ requestStatus: "specimen_collection", remainingCount: 1 });
  const response = await postJson(app, `/technologist/requests/${requestId}/submit-results`);
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.data.partial, true);
  assert.equal(payload.data.remainingTestCount, 1);
  assert.equal(payload.data.assignedPathologistId, null);
  assert.ok(!writes.some((write) => write.query.includes("status = 'for_validation'")));
  assert.ok(writes.some((write) => write.query.includes("'partial', true")));
});

test("submitting the last outstanding test sends the request for validation", async () => {
  const { app, writes } = createSubmissionApp({ requestStatus: "specimen_collection", remainingCount: 0 });
  const response = await postJson(app, `/technologist/requests/${requestId}/submit-results`);
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.data.partial, false);
  assert.equal(payload.data.assignedPathologistId, pathologistId);
  assert.ok(writes.some((write) => write.query.includes("status = 'for_validation'")));
});
