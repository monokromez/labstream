import { getErrorCode, getErrorConstraint } from "./db/errors.js";

// Safety net for constraint failures that a route did not translate itself.
// Constraint names come from backend/supabase/schema.sql.
const UNIQUE_CONSTRAINT_RESPONSES = {
  users_clinic_id_email_key: {
    error: "EMAIL_ALREADY_EXISTS",
    message: "That email address is already assigned to an account in this laboratory. Use a different email address.",
  },
  users_clinic_id_username_key: {
    error: "USERNAME_ALREADY_EXISTS",
    message: "That username is already taken in this laboratory.",
  },
  users_clinic_id_staff_number_key: {
    error: "STAFF_NUMBER_ALREADY_EXISTS",
    message: "That staff number is already assigned to an account in this laboratory.",
  },
  test_categories_clinic_id_name_key: {
    error: "CATEGORY_EXISTS",
    message: "A test category with that name already exists.",
  },
  test_catalog_clinic_id_code_key: {
    error: "TEST_CODE_EXISTS",
    message: "A test with that code already exists.",
  },
  invoices_clinic_id_invoice_number_key: {
    error: "INVOICE_NUMBER_EXISTS",
    message: "That invoice number is already in use. Try again.",
  },
  patients_clinic_id_pid_key: {
    error: "PID_ALREADY_EXISTS",
    message: "That patient ID is already in use. Try again.",
  },
};

// Returns an HTTP response for PostgreSQL SQLSTATE errors that should never
// surface as a generic 500, or null when the error is not one of them.
export function sqlStateErrorResponse(error) {
  const sqlState = getErrorCode(error);
  if (sqlState === "23505") {
    return {
      status: 409,
      body: UNIQUE_CONSTRAINT_RESPONSES[getErrorConstraint(error)] ?? {
        error: "DUPLICATE_RECORD",
        message: "A record with those details already exists. Check the values and try again.",
      },
    };
  }
  if (sqlState === "23514") {
    return {
      status: 400,
      body: {
        error: "INVALID_RECORD",
        message: "Some of those details are not allowed. Check the values and try again.",
      },
    };
  }
  return null;
}
