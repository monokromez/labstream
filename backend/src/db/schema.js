import {
  bigint, boolean, date, integer, jsonb, numeric, pgEnum, pgTable, smallint, text, timestamp, uniqueIndex, uuid, varchar,
} from "drizzle-orm/pg-core";

// Runtime Drizzle model mirroring supabase/schema.sql. That SQL remains
// authoritative because it also defines triggers, functions, RLS, and a view.
const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

export const userRole = pgEnum("user_role", ["administrator", "cashier", "medical_technologist", "pathologist", "patient"]);
export const requestStatus = pgEnum("request_status", ["awaiting_payment", "paid", "specimen_collection", "processing", "for_validation", "correction", "released", "cancelled"]);
export const requestItemStatus = pgEnum("request_item_status", ["awaiting_specimen", "specimen_received", "processing", "drafted", "submitted", "returned", "for_recollection", "approved", "released", "cancelled"]);
export const specimenStatus = pgEnum("specimen_status", ["expected", "received", "accepted", "rejected", "for_recollection", "consumed"]);
export const resultValueType = pgEnum("result_value_type", ["numeric", "text", "select", "boolean"]);
export const resultStatus = pgEnum("result_status", ["draft", "submitted", "returned", "approved"]);
export const reviewDecision = pgEnum("review_decision", ["approved", "returned"]);
export const paymentMethod = pgEnum("payment_method", ["cash", "waiver"]);

export const clinics = pgTable("clinics", {
  id: id(), code: varchar("code", { length: 24 }).notNull(), name: varchar("name", { length: 180 }).notNull(),
  instanceSlot: smallint("instance_slot").notNull().default(1).unique(),
  registrationNumber: varchar("registration_number", { length: 100 }), email: varchar("email", { length: 254 }),
  phone: varchar("phone", { length: 32 }), isActive: boolean("is_active").notNull().default(true),
  createdAt: createdAt(), updatedAt: updatedAt(),
});
export const users = pgTable("users", {
  id: id(), clinicId: uuid("clinic_id").notNull(), role: userRole("role").notNull(),
  staffNumber: integer("staff_number").generatedAlwaysAsIdentity(), username: varchar("username", { length: 80 }), email: varchar("email", { length: 254 }),
  passwordHash: varchar("password_hash", { length: 255 }), isActive: boolean("is_active").notNull().default(false),
  mustChangePassword: boolean("must_change_password").notNull().default(true),
  lastSignInAt: timestamp("last_sign_in_at", { withTimezone: true }), createdAt: createdAt(), updatedAt: updatedAt(),
});
export const staffProfiles = pgTable("staff_profiles", {
  userId: uuid("user_id").primaryKey(), clinicId: uuid("clinic_id").notNull(),
  firstName: varchar("first_name", { length: 100 }).notNull(), middleName: varchar("middle_name", { length: 100 }),
  lastName: varchar("last_name", { length: 100 }).notNull(), dateOfBirth: date("date_of_birth"), phone: varchar("phone", { length: 32 }),
  email: varchar("email", { length: 254 }), country: varchar("country", { length: 100 }), city: varchar("city", { length: 120 }),
  houseNumber: varchar("house_number", { length: 80 }), street: varchar("street", { length: 160 }), createdAt: createdAt(), updatedAt: updatedAt(),
});
export const accountTokens = pgTable("account_tokens", {
  id: id(), clinicId: uuid("clinic_id").notNull(), userId: uuid("user_id").notNull(), tokenHash: varchar("token_hash", { length: 64 }).notNull(),
  purpose: varchar("purpose", { length: 24 }).notNull(), expiresAt: timestamp("expires_at", { withTimezone: true }),
  consumedAt: timestamp("consumed_at", { withTimezone: true }), createdAt: createdAt(),
});
export const patients = pgTable("patients", {
  id: id(), clinicId: uuid("clinic_id").notNull(), portalUserId: uuid("portal_user_id"),
  pid: varchar("pid", { length: 32 }).notNull(), firstName: varchar("first_name", { length: 100 }).notNull(),
  middleName: varchar("middle_name", { length: 100 }), lastName: varchar("last_name", { length: 100 }).notNull(),
  dateOfBirth: date("date_of_birth").notNull(), sex: varchar("sex", { length: 32 }).notNull(),
  email: varchar("email", { length: 254 }), phone: varchar("phone", { length: 32 }).notNull(),
  country: varchar("country", { length: 100 }).notNull(), city: varchar("city", { length: 120 }).notNull(),
  houseNumber: varchar("house_number", { length: 80 }), street: varchar("street", { length: 160 }),
  validIdType: varchar("valid_id_type", { length: 100 }).notNull(), validIdNumber: varchar("valid_id_number", { length: 120 }).notNull(),
  registeredBy: uuid("registered_by").notNull(), createdAt: createdAt(), updatedAt: updatedAt(),
});
export const testCategories = pgTable("test_categories", {
  id: id(), clinicId: uuid("clinic_id").notNull(), name: varchar("name", { length: 120 }).notNull(), description: text("description"),
  isActive: boolean("is_active").notNull().default(true), createdAt: createdAt(), updatedAt: updatedAt(),
});
export const testCatalog = pgTable("test_catalog", {
  id: id(), clinicId: uuid("clinic_id").notNull(), categoryId: uuid("category_id").notNull(), code: varchar("code", { length: 40 }).notNull(),
  name: varchar("name", { length: 160 }).notNull(), description: text("description"), price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  turnaroundMinutes: integer("turnaround_minutes"), isAvailable: boolean("is_available").notNull().default(true), createdAt: createdAt(), updatedAt: updatedAt(),
});
export const testCategoryMemberships = pgTable("test_category_memberships", {
  clinicId: uuid("clinic_id").notNull(), testId: uuid("test_id").notNull(), categoryId: uuid("category_id").notNull(),
  createdAt: createdAt(),
});
export const testSpecimenRequirements = pgTable("test_specimen_requirements", {
  id: id(), clinicId: uuid("clinic_id").notNull(), testId: uuid("test_id").notNull(), specimenType: varchar("specimen_type", { length: 100 }).notNull(),
  collectionInstructions: text("collection_instructions"), minimumQuantity: numeric("minimum_quantity", { precision: 10, scale: 2 }),
  quantityUnit: varchar("quantity_unit", { length: 40 }), isRequired: boolean("is_required").notNull().default(true),
  createdAt: createdAt(), updatedAt: updatedAt(),
});
export const testAnalytes = pgTable("test_analytes", {
  id: id(), clinicId: uuid("clinic_id").notNull(), testId: uuid("test_id").notNull(), key: varchar("key", { length: 80 }).notNull(),
  label: varchar("label", { length: 160 }).notNull(), valueType: resultValueType("value_type").notNull(),
  options: jsonb("options").notNull().default([]), unit: varchar("unit", { length: 40 }), sortOrder: integer("sort_order").notNull().default(0),
  isRequired: boolean("is_required").notNull().default(true), createdAt: createdAt(), updatedAt: updatedAt(),
});
export const referenceRanges = pgTable("reference_ranges", {
  id: id(), clinicId: uuid("clinic_id").notNull(), analyteId: uuid("analyte_id").notNull(), sex: varchar("sex", { length: 32 }),
  minAgeDays: integer("min_age_days"), maxAgeDays: integer("max_age_days"),
  lowerLimit: numeric("lower_limit", { precision: 14, scale: 4 }), upperLimit: numeric("upper_limit", { precision: 14, scale: 4 }),
  unit: varchar("unit", { length: 40 }), guidance: text("guidance"), isActive: boolean("is_active").notNull().default(true),
  createdAt: createdAt(), updatedAt: updatedAt(),
});
export const testRequests = pgTable("test_requests", {
  id: id(), clinicId: uuid("clinic_id").notNull(), requestNumber: varchar("request_number", { length: 32 }).notNull(),
  patientId: uuid("patient_id").notNull(), createdBy: uuid("created_by").notNull(), status: requestStatus("status").notNull().default("awaiting_payment"),
  priority: varchar("priority", { length: 16 }).notNull().default("routine"), totalAmount: numeric("total_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  assignedTechnologistId: uuid("assigned_technologist_id"), assignedPathologistId: uuid("assigned_pathologist_id"),
  queueTicket: bigint("queue_ticket", { mode: "number" }).generatedAlwaysAsIdentity(), queueCalledAt: timestamp("queue_called_at", { withTimezone: true }),
  queueCalledBy: uuid("queue_called_by"),
  requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(), paidAt: timestamp("paid_at", { withTimezone: true }),
  releasedAt: timestamp("released_at", { withTimezone: true }), cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  cancellationReason: text("cancellation_reason"), createdAt: createdAt(), updatedAt: updatedAt(),
}, (table) => [uniqueIndex("test_requests_queue_ticket_uidx").on(table.queueTicket)]);
export const requestItems = pgTable("request_items", {
  id: id(), clinicId: uuid("clinic_id").notNull(), requestId: uuid("request_id").notNull(), testId: uuid("test_id").notNull(),
  testCodeSnapshot: varchar("test_code_snapshot", { length: 40 }).notNull(), testNameSnapshot: varchar("test_name_snapshot", { length: 160 }).notNull(),
  categoryNameSnapshot: varchar("category_name_snapshot", { length: 120 }).notNull(), priceSnapshot: numeric("price_snapshot", { precision: 10, scale: 2 }).notNull(),
  status: requestItemStatus("status").notNull().default("awaiting_specimen"), createdAt: createdAt(), updatedAt: updatedAt(),
});
export const payments = pgTable("payments", {
  id: id(), clinicId: uuid("clinic_id").notNull(), requestId: uuid("request_id").notNull(), amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  method: paymentMethod("method").notNull().default("cash"), recordedBy: uuid("recorded_by").notNull(), paidAt: timestamp("paid_at", { withTimezone: true }).notNull().defaultNow(),
  voidedAt: timestamp("voided_at", { withTimezone: true }), voidedBy: uuid("voided_by"), voidReason: text("void_reason"), createdAt: createdAt(),
});
export const invoices = pgTable("invoices", {
  id: id(), clinicId: uuid("clinic_id").notNull(), paymentId: uuid("payment_id").notNull(), invoiceNumber: varchar("invoice_number", { length: 64 }).notNull(), issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(),
});
export const specimens = pgTable("specimens", {
  id: id(), clinicId: uuid("clinic_id").notNull(), requestId: uuid("request_id").notNull(), specimenType: varchar("specimen_type", { length: 100 }).notNull(),
  attemptNumber: integer("attempt_number").notNull().default(1), replacesSpecimenId: uuid("replaces_specimen_id"), status: specimenStatus("status").notNull().default("expected"),
  collectedAt: timestamp("collected_at", { withTimezone: true }), receivedAt: timestamp("received_at", { withTimezone: true }), receivedBy: uuid("received_by"),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }), rejectedAt: timestamp("rejected_at", { withTimezone: true }), rejectionReason: text("rejection_reason"),
  notes: text("notes"), createdAt: createdAt(), updatedAt: updatedAt(),
});
export const specimenRequestItems = pgTable("specimen_request_items", {
  clinicId: uuid("clinic_id").notNull(), requestId: uuid("request_id").notNull(), specimenId: uuid("specimen_id").notNull(), requestItemId: uuid("request_item_id").notNull(),
});
export const resultSubmissions = pgTable("result_submissions", {
  id: id(), clinicId: uuid("clinic_id").notNull(), requestId: uuid("request_id").notNull(), requestItemId: uuid("request_item_id").notNull(), specimenId: uuid("specimen_id").notNull(),
  revisionNumber: integer("revision_number").notNull(), status: resultStatus("status").notNull().default("draft"), enteredBy: uuid("entered_by").notNull(),
  enteredAt: timestamp("entered_at", { withTimezone: true }).notNull().defaultNow(), submittedAt: timestamp("submitted_at", { withTimezone: true }),
  pathologistInterpretation: text("pathologist_interpretation"), supersedesResultId: uuid("supersedes_result_id"), createdAt: createdAt(), updatedAt: updatedAt(),
});
export const resultSubmissionSpecimens = pgTable("result_submission_specimens", {
  clinicId: uuid("clinic_id").notNull(), requestId: uuid("request_id").notNull(), resultSubmissionId: uuid("result_submission_id").notNull(), specimenId: uuid("specimen_id").notNull(),
});
export const resultValues = pgTable("result_values", {
  id: id(), clinicId: uuid("clinic_id").notNull(), resultSubmissionId: uuid("result_submission_id").notNull(), analyteId: uuid("analyte_id").notNull(),
  numericValue: numeric("numeric_value", { precision: 14, scale: 4 }), textValue: text("text_value"), selectValue: text("select_value"), booleanValue: boolean("boolean_value"),
  unitSnapshot: varchar("unit_snapshot", { length: 40 }), lowerLimitSnapshot: numeric("lower_limit_snapshot", { precision: 14, scale: 4 }),
  upperLimitSnapshot: numeric("upper_limit_snapshot", { precision: 14, scale: 4 }), isAbnormal: boolean("is_abnormal").notNull().default(false),
  createdAt: createdAt(), updatedAt: updatedAt(),
});
export const resultReviews = pgTable("result_reviews", {
  id: id(), clinicId: uuid("clinic_id").notNull(), resultSubmissionId: uuid("result_submission_id").notNull(), reviewedBy: uuid("reviewed_by").notNull(),
  decision: reviewDecision("decision").notNull(), remarks: text("remarks"), requiresRetest: boolean("requires_retest").notNull().default(false), reviewedAt: timestamp("reviewed_at", { withTimezone: true }).notNull().defaultNow(),
});
export const requestStatusHistory = pgTable("request_status_history", {
  id: id(), clinicId: uuid("clinic_id").notNull(), requestId: uuid("request_id").notNull(), oldStatus: requestStatus("old_status"),
  newStatus: requestStatus("new_status").notNull(), changedBy: uuid("changed_by"), note: text("note"), changedAt: timestamp("changed_at", { withTimezone: true }).notNull().defaultNow(),
});
export const auditLogs = pgTable("audit_logs", {
  id: id(), clinicId: uuid("clinic_id").notNull(), actorUserId: uuid("actor_user_id"), action: varchar("action", { length: 100 }).notNull(),
  entityType: varchar("entity_type", { length: 100 }).notNull(), entityId: uuid("entity_id"), details: jsonb("details").notNull().default({}), createdAt: createdAt(),
});
