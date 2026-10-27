import assert from "node:assert/strict";
import { test } from "node:test";
import { getErrorCode, getErrorConstraint, isCheckViolation, isUniqueViolation } from "../src/db/errors.js";
import { sqlStateErrorResponse } from "../src/errorResponse.js";

test("resolves application error codes without a cause", () => {
  const error = Object.assign(new Error("Staff account was not found."), { code: "STAFF_NOT_FOUND" });
  assert.equal(getErrorCode(error), "STAFF_NOT_FOUND");
  assert.equal(isUniqueViolation(error), false);
});

test("unwraps the PostgreSQL error Drizzle stores on cause", () => {
  const driverError = Object.assign(
    new Error('duplicate key value violates unique constraint "users_clinic_id_email_key"'),
    { code: "23505", constraint: "users_clinic_id_email_key" },
  );
  const wrapped = new Error("Failed query: insert into public.users");
  wrapped.cause = driverError;

  assert.equal(getErrorCode(wrapped), "23505");
  assert.equal(getErrorConstraint(wrapped), "users_clinic_id_email_key");
  assert.equal(isUniqueViolation(wrapped), true);
  assert.equal(isCheckViolation(wrapped), false);
});

test("handles deeply nested causes and circular references", () => {
  const driverError = Object.assign(new Error("check violation"), { code: "23514", constraint_name: "available_test_requires_reference_range" });
  const middle = new Error("query failed");
  middle.cause = driverError;
  const outer = new Error("route failed");
  outer.cause = middle;
  driverError.cause = outer;

  assert.equal(getErrorCode(outer), "23514");
  assert.equal(getErrorConstraint(outer), "available_test_requires_reference_range");
  assert.equal(isCheckViolation(outer), true);
});

test("maps a duplicate email constraint to a clear 409 response", () => {
  const wrapped = new Error("Failed query: insert into public.users");
  wrapped.cause = Object.assign(new Error("duplicate key value"), {
    code: "23505",
    constraint: "users_clinic_id_email_key",
  });

  assert.deepEqual(sqlStateErrorResponse(wrapped), {
    status: 409,
    body: {
      error: "EMAIL_ALREADY_EXISTS",
      message: "That email address is already assigned to an account in this laboratory. Use a different email address.",
    },
  });
});

test("maps an unknown unique violation to a generic 409 instead of a 500", () => {
  const wrapped = new Error("Failed query: insert");
  wrapped.cause = Object.assign(new Error("duplicate key value"), { code: "23505", constraint: "some_other_key" });

  assert.deepEqual(sqlStateErrorResponse(wrapped), {
    status: 409,
    body: {
      error: "DUPLICATE_RECORD",
      message: "A record with those details already exists. Check the values and try again.",
    },
  });
});

test("leaves unrelated errors for the generic 500 handler", () => {
  assert.equal(sqlStateErrorResponse(new Error("boom")), null);
});
