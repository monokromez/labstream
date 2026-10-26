import assert from "node:assert/strict";
import { test } from "node:test";
import {
  validateCategoryDetails,
  validateReferenceRangeDetails,
  validateStaffDetails,
  validateStaffRoleChange,
  validateTestDetails,
} from "../src/adminValidation.js";

const categoryId = "550e8400-e29b-41d4-a716-446655440000";

test("accepts complete staff details with valid contact and address fields", () => {
  const errors = validateStaffDetails({
    role: "cashier",
    firstName: "Alex",
    middleName: "Morgan",
    lastName: "Rivera",
    dateOfBirth: "1990-05-20",
    phone: "+14155552671",
    countryCode: "US",
    email: "alex.rivera@gmail.com",
    country: "United States",
    city: "San Francisco",
    houseNumber: "12",
    street: "Market Street",
  });

  assert.deepEqual(errors, {});
});

test("rejects invalid staff role, identity, contact, and address values", () => {
  const errors = validateStaffDetails({
    role: "administrator",
    firstName: "A",
    lastName: "Rivera1",
    dateOfBirth: "2023-02-29",
    phone: "not a phone",
    countryCode: "US",
    email: "alex@example.org",
    country: "",
    city: "X",
    houseNumber: "",
    street: "X",
  });

  for (const field of ["role", "firstName", "lastName", "dateOfBirth", "phone", "email", "country", "city", "houseNumber", "street"]) {
    assert.ok(errors[field], `expected ${field} to be invalid`);
  }
});

test("allows administrator role validation only for an existing administrator profile update", () => {
  const details = {
    role: "administrator",
    firstName: "Alex",
    lastName: "Rivera",
    dateOfBirth: "1990-05-20",
    phone: "+14155552671",
    countryCode: "US",
    email: "alex.rivera@gmail.com",
    country: "United States",
    city: "San Francisco",
    houseNumber: "12",
    street: "Market Street",
  };

  assert.ok(validateStaffDetails(details).role);
  assert.deepEqual(validateStaffDetails(details, { allowAdministrator: true }), {});
  assert.ok(validateStaffDetails({ ...details, countryCode: "PH" }).phone);
});

test("role changes require an activated, inactive staff account with no active assignments", () => {
  const base = {
    currentRole: "cashier",
    nextRole: "pathologist",
    isActive: false,
    isPendingActivation: false,
    hasActiveWork: false,
  };

  assert.equal(validateStaffRoleChange(base), null);
  assert.equal(validateStaffRoleChange({ ...base, isActive: true }).code, "STAFF_ROLE_CHANGE_REQUIRES_INACTIVE");
  assert.equal(validateStaffRoleChange({ ...base, isPendingActivation: true }).code, "STAFF_ACTIVATION_PENDING");
  assert.equal(validateStaffRoleChange({ ...base, hasActiveWork: true }).code, "STAFF_ROLE_CHANGE_HAS_ACTIVE_WORK");
  assert.equal(validateStaffRoleChange({ ...base, currentRole: "administrator" }).code, "STAFF_ROLE_CHANGE_UNSUPPORTED");
});

test("validates category lengths and descriptions", () => {
  assert.equal(validateCategoryDetails({ name: "Hematology", description: "Routine blood tests" }), "");
  assert.ok(validateCategoryDetails({ name: "x" }));
  assert.ok(validateCategoryDetails({ name: "Hematology", description: "x".repeat(1001) }));
});

test("requires valid catalog pricing, categories, specimens, and result parameters", () => {
  const validTest = {
    name: "Complete Blood Count",
    categoryIds: [categoryId],
    price: 125.5,
    turnaroundMinutes: 60,
    specimens: [{ specimenType: "Whole blood", minimumQuantity: 1, isRequired: true }],
    analytes: [{ key: "HEMOGLOBIN", label: "Hemoglobin", valueType: "numeric", unit: "g/dL", options: [], isRequired: true }],
  };
  assert.equal(validateTestDetails(validTest), "");
  assert.match(validateTestDetails({ ...validTest, price: "125.501" }), /Price/);
  assert.match(validateTestDetails({ ...validTest, categoryIds: ["bad-id"] }), /categor/i);
  assert.match(validateTestDetails({ ...validTest, specimens: [] }), /specimen/i);
  assert.match(validateTestDetails({ ...validTest, analytes: [{ ...validTest.analytes[0], valueType: "select" }] }), /options/i);
});

test("validates reference range boundaries and partial updates", () => {
  const validRange = {
    analyteId: categoryId,
    sex: null,
    minAgeDays: 0,
    maxAgeDays: 43830,
    lowerLimit: 1.2,
    upperLimit: 8.2,
    unit: "mg/dL",
  };
  assert.equal(validateReferenceRangeDetails(validRange), "");
  assert.match(validateReferenceRangeDetails({ ...validRange, minAgeDays: 100, maxAgeDays: 50 }), /age/i);
  assert.match(validateReferenceRangeDetails({ ...validRange, lowerLimit: 10, upperLimit: 2 }), /limit/i);
  assert.equal(validateReferenceRangeDetails({ upperLimit: 8 }, { partial: true }), "");
  assert.match(validateReferenceRangeDetails({ analyteId: "invalid" }, { partial: true }), /result parameter/i);
});
