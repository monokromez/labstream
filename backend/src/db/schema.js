import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const userRole = pgEnum("user_role", [
  "cashier",
  "medical_technologist",
  "pathologist",
  "administrator",
  "patient",
]);

export const resultType = pgEnum("result_type", ["numeric", "text"]);

export const requestStatus = pgEnum("request_status", [
  "queued",
  "paid",
  "specimen_received",
  "processing",
  "for_validation",
  "released",
  "cancelled",
]);

export const queueStatus = pgEnum("queue_status", [
  "waiting",
  "called",
  "serving",
  "completed",
  "cancelled",
]);

export const paymentMethod = pgEnum("payment_method", ["cash", "card", "other"]);
export const reviewDecision = pgEnum("review_decision", ["approved", "returned"]);

const createdAt = () => timestamp("created_at", { withTimezone: true }).defaultNow().notNull();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).defaultNow().notNull();

// One clinic site per tenant. Multi-branch administration is outside the
// approved proposal; a separately deployed branch can have its own tenant.
export const clinics = pgTable(
  "clinics",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: varchar("code", { length: 24 }).notNull().unique(),
    name: varchar("name", { length: 180 }).notNull(),
    registrationNumber: varchar("registration_number", { length: 100 }),
    email: varchar("email", { length: 254 }),
    phone: varchar("phone", { length: 32 }),
    address: text("address"),
    city: varchar("city", { length: 120 }),
    country: varchar("country", { length: 100 }),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
);

// Pending accounts have no password hash until the one-time activation token
// is redeemed. Active passwords are Argon2id hashes, never plaintext.
export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clinicId: uuid("clinic_id").notNull().references(() => clinics.id, { onDelete: "restrict" }),
    username: varchar("username", { length: 80 }),
    staffNumber: integer("staff_number").generatedAlwaysAsIdentity(),
    email: varchar("email", { length: 254 }),
    passwordHash: varchar("password_hash", { length: 255 }),
    role: userRole("role").notNull(),
    isActive: boolean("is_active").default(false).notNull(),
    mustChangePassword: boolean("must_change_password").default(true).notNull(),
    lastSignInAt: timestamp("last_sign_in_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    unique("users_id_clinic_unique").on(table.id, table.clinicId),
    unique("users_clinic_username_unique").on(table.clinicId, table.username),
    unique("users_clinic_staff_number_unique").on(table.clinicId, table.staffNumber),
    unique("users_clinic_email_unique").on(table.clinicId, table.email),
    check(
      "users_staff_email_required",
      sql`${table.role} = 'patient' OR ${table.email} IS NOT NULL`,
    ),
    check(
      "users_staff_username_required",
      sql`${table.role} = 'patient' OR ${table.username} IS NOT NULL`,
    ),
  ],
);

export const staffProfiles = pgTable(
  "staff_profiles",
  {
    userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "restrict" }),
    clinicId: uuid("clinic_id").notNull().references(() => clinics.id, { onDelete: "restrict" }),
    firstName: varchar("first_name", { length: 100 }).notNull(),
    middleName: varchar("middle_name", { length: 100 }),
    lastName: varchar("last_name", { length: 100 }).notNull(),
    dateOfBirth: date("date_of_birth"),
    phone: varchar("phone", { length: 32 }),
    country: varchar("country", { length: 100 }),
    city: varchar("city", { length: 120 }),
    houseNumber: varchar("house_number", { length: 80 }),
    street: varchar("street", { length: 160 }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    foreignKey({
      columns: [table.userId, table.clinicId],
      foreignColumns: [users.id, users.clinicId],
      name: "staff_profiles_user_same_clinic_fk",
    }).onDelete("restrict"),
  ],
);

// Store only a SHA-256 digest. The raw, high-entropy code is shown/delivered
// once, expires, and is consumed on activation or password reset.
export const accountTokens = pgTable(
  "account_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clinicId: uuid("clinic_id").notNull().references(() => clinics.id, { onDelete: "restrict" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
    purpose: varchar("purpose", { length: 24 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (table) => [
    index("account_tokens_user_purpose_idx").on(table.userId, table.purpose, table.expiresAt),
    foreignKey({
      columns: [table.userId, table.clinicId],
      foreignColumns: [users.id, users.clinicId],
      name: "account_tokens_user_same_clinic_fk",
    }).onDelete("restrict"),
    check("account_tokens_purpose_check", sql`${table.purpose} IN ('activation', 'password_reset')`),
  ],
);

export const patients = pgTable(
  "patients",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clinicId: uuid("clinic_id").notNull().references(() => clinics.id, { onDelete: "restrict" }),
    userId: uuid("user_id")
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: "restrict" }),
    pid: varchar("pid", { length: 32 }).notNull(),
    firstName: varchar("first_name", { length: 100 }).notNull(),
    middleName: varchar("middle_name", { length: 100 }),
    lastName: varchar("last_name", { length: 100 }).notNull(),
    dateOfBirth: date("date_of_birth"),
    sex: varchar("sex", { length: 32 }),
    phone: varchar("phone", { length: 32 }),
    address: text("address"),
    email: varchar("email", { length: 254 }),
    country: varchar("country", { length: 100 }),
    city: varchar("city", { length: 120 }),
    houseNumber: varchar("house_number", { length: 80 }),
    street: varchar("street", { length: 160 }),
    validIdType: varchar("valid_id_type", { length: 100 }),
    validIdNumber: varchar("valid_id_number", { length: 120 }),
    registeredBy: uuid("registered_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    unique("patients_id_clinic_unique").on(table.id, table.clinicId),
    unique("patients_clinic_pid_unique").on(table.clinicId, table.pid),
    index("patients_name_idx").on(table.clinicId, table.lastName, table.firstName),
    foreignKey({
      columns: [table.userId, table.clinicId],
      foreignColumns: [users.id, users.clinicId],
      name: "patients_user_same_clinic_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.registeredBy, table.clinicId],
      foreignColumns: [users.id, users.clinicId],
      name: "patients_registrar_same_clinic_fk",
    }).onDelete("restrict"),
  ],
);

export const testCatalog = pgTable(
  "test_catalog",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clinicId: uuid("clinic_id").notNull().references(() => clinics.id, { onDelete: "restrict" }),
    code: varchar("code", { length: 40 }).notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    description: text("description"),
    resultType: resultType("result_type").notNull(),
    unit: varchar("unit", { length: 40 }),
    price: numeric("price", { precision: 10, scale: 2 }).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    unique("test_catalog_id_clinic_unique").on(table.id, table.clinicId),
    unique("test_catalog_clinic_code_unique").on(table.clinicId, table.code),
    check("test_catalog_price_nonnegative", sql`${table.price} >= 0`),
  ],
);

export const referenceRanges = pgTable(
  "reference_ranges",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clinicId: uuid("clinic_id").notNull().references(() => clinics.id, { onDelete: "restrict" }),
    testId: uuid("test_id")
      .notNull()
      .references(() => testCatalog.id, { onDelete: "restrict" }),
    minAgeDays: integer("min_age_days"),
    maxAgeDays: integer("max_age_days"),
    sex: varchar("sex", { length: 32 }),
    numericMin: numeric("numeric_min", { precision: 14, scale: 4 }),
    numericMax: numeric("numeric_max", { precision: 14, scale: 4 }),
    textGuidance: text("text_guidance"),
    unit: varchar("unit", { length: 40 }),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("reference_ranges_test_active_idx").on(table.testId, table.isActive),
    foreignKey({
      columns: [table.testId, table.clinicId],
      foreignColumns: [testCatalog.id, testCatalog.clinicId],
      name: "reference_ranges_test_same_clinic_fk",
    }).onDelete("restrict"),
    check(
      "reference_ranges_age_order",
      sql`${table.minAgeDays} IS NULL OR ${table.maxAgeDays} IS NULL OR ${table.minAgeDays} <= ${table.maxAgeDays}`,
    ),
    check(
      "reference_ranges_numeric_order",
      sql`${table.numericMin} IS NULL OR ${table.numericMax} IS NULL OR ${table.numericMin} <= ${table.numericMax}`,
    ),
  ],
);

export const testRequests = pgTable(
  "test_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clinicId: uuid("clinic_id").notNull().references(() => clinics.id, { onDelete: "restrict" }),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "restrict" }),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    status: requestStatus("status").default("queued").notNull(),
    totalAmount: numeric("total_amount", { precision: 10, scale: 2 }).default("0").notNull(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    releasedAt: timestamp("released_at", { withTimezone: true }),
    releasedBy: uuid("released_by").references(() => users.id, { onDelete: "restrict" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    unique("test_requests_id_clinic_unique").on(table.id, table.clinicId),
    index("test_requests_patient_created_idx").on(table.patientId, table.createdAt),
    index("test_requests_status_created_idx").on(table.status, table.createdAt),
    foreignKey({
      columns: [table.patientId, table.clinicId],
      foreignColumns: [patients.id, patients.clinicId],
      name: "test_requests_patient_same_clinic_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.createdBy, table.clinicId],
      foreignColumns: [users.id, users.clinicId],
      name: "test_requests_creator_same_clinic_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.releasedBy, table.clinicId],
      foreignColumns: [users.id, users.clinicId],
      name: "test_requests_releaser_same_clinic_fk",
    }).onDelete("restrict"),
    check("test_requests_total_nonnegative", sql`${table.totalAmount} >= 0`),
  ],
);

export const requestItems = pgTable(
  "request_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clinicId: uuid("clinic_id").notNull().references(() => clinics.id, { onDelete: "restrict" }),
    requestId: uuid("request_id")
      .notNull()
      .references(() => testRequests.id, { onDelete: "restrict" }),
    testId: uuid("test_id")
      .notNull()
      .references(() => testCatalog.id, { onDelete: "restrict" }),
    testNameSnapshot: varchar("test_name_snapshot", { length: 160 }).notNull(),
    priceSnapshot: numeric("price_snapshot", { precision: 10, scale: 2 }).notNull(),
    resultTypeSnapshot: resultType("result_type_snapshot").notNull(),
    unitSnapshot: varchar("unit_snapshot", { length: 40 }),
    createdAt: createdAt(),
  },
  (table) => [
    unique("request_items_id_clinic_unique").on(table.id, table.clinicId),
    index("request_items_request_idx").on(table.requestId),
    foreignKey({
      columns: [table.requestId, table.clinicId],
      foreignColumns: [testRequests.id, testRequests.clinicId],
      name: "request_items_request_same_clinic_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.testId, table.clinicId],
      foreignColumns: [testCatalog.id, testCatalog.clinicId],
      name: "request_items_test_same_clinic_fk",
    }).onDelete("restrict"),
    check("request_items_price_nonnegative", sql`${table.priceSnapshot} >= 0`),
  ],
);

export const queueEntries = pgTable(
  "queue_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clinicId: uuid("clinic_id").notNull().references(() => clinics.id, { onDelete: "restrict" }),
    requestId: uuid("request_id")
      .notNull()
      .unique()
      .references(() => testRequests.id, { onDelete: "restrict" }),
    queueDate: date("queue_date").default(sql`CURRENT_DATE`).notNull(),
    queueNumber: integer("queue_number").notNull(),
    status: queueStatus("status").default("waiting").notNull(),
    calledAt: timestamp("called_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    calledBy: uuid("called_by").references(() => users.id, { onDelete: "restrict" }),
    createdAt: createdAt(),
  },
  (table) => [
    unique("queue_entries_date_number_unique").on(table.clinicId, table.queueDate, table.queueNumber),
    index("queue_entries_date_status_idx").on(table.queueDate, table.status),
    foreignKey({
      columns: [table.requestId, table.clinicId],
      foreignColumns: [testRequests.id, testRequests.clinicId],
      name: "queue_entries_request_same_clinic_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.calledBy, table.clinicId],
      foreignColumns: [users.id, users.clinicId],
      name: "queue_entries_caller_same_clinic_fk",
    }).onDelete("restrict"),
    check("queue_entries_number_positive", sql`${table.queueNumber} > 0`),
  ],
);

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clinicId: uuid("clinic_id").notNull().references(() => clinics.id, { onDelete: "restrict" }),
    requestId: uuid("request_id")
      .notNull()
      .references(() => testRequests.id, { onDelete: "restrict" }),
    amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
    method: paymentMethod("method").notNull(),
    receiptNumber: varchar("receipt_number", { length: 64 }).notNull(),
    recordedBy: uuid("recorded_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    paidAt: timestamp("paid_at", { withTimezone: true }).defaultNow().notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    unique("payments_clinic_receipt_number_unique").on(table.clinicId, table.receiptNumber),
    index("payments_request_idx").on(table.requestId),
    index("payments_paid_at_idx").on(table.paidAt),
    foreignKey({
      columns: [table.requestId, table.clinicId],
      foreignColumns: [testRequests.id, testRequests.clinicId],
      name: "payments_request_same_clinic_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.recordedBy, table.clinicId],
      foreignColumns: [users.id, users.clinicId],
      name: "payments_recorder_same_clinic_fk",
    }).onDelete("restrict"),
    check("payments_amount_positive", sql`${table.amount} > 0`),
  ],
);

export const specimens = pgTable(
  "specimens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clinicId: uuid("clinic_id").notNull().references(() => clinics.id, { onDelete: "restrict" }),
    requestId: uuid("request_id")
      .notNull()
      .references(() => testRequests.id, { onDelete: "restrict" }),
    specimenType: varchar("specimen_type", { length: 100 }).notNull(),
    receivedBy: uuid("received_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow().notNull(),
    notes: text("notes"),
    createdAt: createdAt(),
  },
  (table) => [
    index("specimens_request_idx").on(table.requestId),
    foreignKey({
      columns: [table.requestId, table.clinicId],
      foreignColumns: [testRequests.id, testRequests.clinicId],
      name: "specimens_request_same_clinic_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.receivedBy, table.clinicId],
      foreignColumns: [users.id, users.clinicId],
      name: "specimens_receiver_same_clinic_fk",
    }).onDelete("restrict"),
  ],
);

export const results = pgTable(
  "results",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clinicId: uuid("clinic_id").notNull().references(() => clinics.id, { onDelete: "restrict" }),
    requestItemId: uuid("request_item_id")
      .notNull()
      .unique()
      .references(() => requestItems.id, { onDelete: "restrict" }),
    numericValue: numeric("numeric_value", { precision: 14, scale: 4 }),
    textValue: text("text_value"),
    unit: varchar("unit", { length: 40 }),
    referenceMinSnapshot: numeric("reference_min_snapshot", { precision: 14, scale: 4 }),
    referenceMaxSnapshot: numeric("reference_max_snapshot", { precision: 14, scale: 4 }),
    isAbnormal: boolean("is_abnormal").default(false).notNull(),
    remarks: text("remarks"),
    encodedBy: uuid("encoded_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    encodedAt: timestamp("encoded_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: updatedAt(),
  },
  (table) => [
    foreignKey({
      columns: [table.requestItemId, table.clinicId],
      foreignColumns: [requestItems.id, requestItems.clinicId],
      name: "results_request_item_same_clinic_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.encodedBy, table.clinicId],
      foreignColumns: [users.id, users.clinicId],
      name: "results_encoder_same_clinic_fk",
    }).onDelete("restrict"),
    check(
      "results_exactly_one_value",
      sql`num_nonnulls(${table.numericValue}, ${table.textValue}) = 1`,
    ),
    check(
      "results_reference_order",
      sql`${table.referenceMinSnapshot} IS NULL OR ${table.referenceMaxSnapshot} IS NULL OR ${table.referenceMinSnapshot} <= ${table.referenceMaxSnapshot}`,
    ),
  ],
);

export const resultReviews = pgTable(
  "result_reviews",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clinicId: uuid("clinic_id").notNull().references(() => clinics.id, { onDelete: "restrict" }),
    requestId: uuid("request_id")
      .notNull()
      .references(() => testRequests.id, { onDelete: "restrict" }),
    reviewedBy: uuid("reviewed_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    decision: reviewDecision("decision").notNull(),
    comments: text("comments"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("result_reviews_request_time_idx").on(table.requestId, table.reviewedAt),
    foreignKey({
      columns: [table.requestId, table.clinicId],
      foreignColumns: [testRequests.id, testRequests.clinicId],
      name: "result_reviews_request_same_clinic_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.reviewedBy, table.clinicId],
      foreignColumns: [users.id, users.clinicId],
      name: "result_reviews_reviewer_same_clinic_fk",
    }).onDelete("restrict"),
  ],
);

export const requestStatusHistory = pgTable(
  "request_status_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clinicId: uuid("clinic_id").notNull().references(() => clinics.id, { onDelete: "restrict" }),
    requestId: uuid("request_id")
      .notNull()
      .references(() => testRequests.id, { onDelete: "restrict" }),
    oldStatus: requestStatus("old_status"),
    newStatus: requestStatus("new_status").notNull(),
    changedBy: uuid("changed_by").references(() => users.id, { onDelete: "restrict" }),
    changedAt: timestamp("changed_at", { withTimezone: true }).defaultNow().notNull(),
    note: text("note"),
  },
  (table) => [
    index("request_status_history_request_time_idx").on(table.requestId, table.changedAt),
    foreignKey({
      columns: [table.requestId, table.clinicId],
      foreignColumns: [testRequests.id, testRequests.clinicId],
      name: "status_history_request_same_clinic_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.changedBy, table.clinicId],
      foreignColumns: [users.id, users.clinicId],
      name: "status_history_actor_same_clinic_fk",
    }).onDelete("restrict"),
  ],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clinicId: uuid("clinic_id").notNull().references(() => clinics.id, { onDelete: "restrict" }),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    action: varchar("action", { length: 100 }).notNull(),
    entityType: varchar("entity_type", { length: 100 }).notNull(),
    entityId: uuid("entity_id"),
    details: jsonb("details").default({}).notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    index("audit_logs_actor_time_idx").on(table.actorUserId, table.createdAt),
    index("audit_logs_entity_idx").on(table.entityType, table.entityId),
    foreignKey({
      columns: [table.actorUserId, table.clinicId],
      foreignColumns: [users.id, users.clinicId],
      name: "audit_logs_actor_same_clinic_fk",
    }).onDelete("restrict"),
  ],
);
