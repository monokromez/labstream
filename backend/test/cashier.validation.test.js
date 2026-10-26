import assert from "node:assert/strict";
import { test } from "node:test";
import { validatePatientDetails } from "../src/routes/cashier.js";

test("accepts first names and surnames made of one word with at least two characters", () => {
  const errors = validatePatientDetails({
    firstName: "Keegan",
    lastName: "Alviz",
  });

  assert.equal(errors.firstName, undefined);
  assert.equal(errors.lastName, undefined);
});

test("rejects first names and surnames shorter than two characters", () => {
  const errors = validatePatientDetails({
    firstName: "K",
    lastName: "A",
  });

  assert.equal(errors.firstName, "Enter at least two characters.");
  assert.equal(errors.lastName, "Enter at least two characters.");
});
