import assert from "node:assert/strict";
import { test } from "node:test";
import { validatePatientProfile } from "../src/routes/patient.js";

test("accepts valid patient profile names and international contact details", () => {
  const errors = validatePatientProfile({
    firstName: "Jestoni",
    middleName: "Dela Cruz",
    lastName: "Deasis",
    email: "patient@example.com",
    phone: "+639996575643",
  });

  assert.deepEqual(errors, {});
});

test("rejects invalid patient profile values", () => {
  const errors = validatePatientProfile({
    firstName: "J",
    middleName: "Invalid1",
    lastName: "Deasis",
    email: "not-an-email",
    phone: "123",
  });

  assert.ok(errors.firstName);
  assert.ok(errors.middleName);
  assert.ok(errors.email);
  assert.ok(errors.phone);
});
