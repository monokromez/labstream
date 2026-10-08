import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
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

// Staff and patient login accounts. Patients authenticate by PID through their
// patients row; staff authenticate by email. Passwords must be Argon2 hashes.
export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: varchar("email", { length: 254 }).unique(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    role: userRole("role").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    check(
      "users_staff_email_required",
      sql`${table.role} = 'patient' OR ${table.email} IS NOT NULL`,
    ),
  ],
);

export const patients = pgTable(
  "patients",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: "restrict" }),
    pid: varchar("pid", { length: 32 }).notNull().unique(),
    firstName: varchar("first_name", { length: 100 }).notNull(),
    lastName: varchar("last_name", { length: 100 }).notNull(),
    dateOfBirth: date("date_of_birth"),
    sex: varchar("sex", { length: 32 }),
    phone: varchar("phone", { length: 32 }),
    address: text("address"),
    registeredBy: uuid("registered_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("patients_name_idx").on(table.lastName, table.firstName)],
);

export const testCatalog = pgTable(
  "test_catalog",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: varchar("code", { length: 40 }).notNull().unique(),
    name: varchar("name", { length: 160 }).notNull(),
    description: text("description"),
    resultType: resultType("result_type").notNull(),
    unit: varchar("unit", { length: 40 }),
    price: numeric("price", { precision: 10, scale: 2 }).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [check("test_catalog_price_nonnegative", sql`${table.price} >= 0`)],
);

export const referenceRanges = pgTable(
  "reference_ranges",
  {
    id: uuid("id").defaultRandom().primaryKey(),
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
    index("test_requests_patient_created_idx").on(table.patientId, table.createdAt),
    index("test_requests_status_created_idx").on(table.status, table.createdAt),
    check("test_requests_total_nonnegative", sql`${table.totalAmount} >= 0`),
  ],
);

export const requestItems = pgTable(
  "request_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
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
    index("request_items_request_idx").on(table.requestId),
    check("request_items_price_nonnegative", sql`${table.priceSnapshot} >= 0`),
  ],
);

export const queueEntries = pgTable(
  "queue_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
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
    unique("queue_entries_date_number_unique").on(table.queueDate, table.queueNumber),
    index("queue_entries_date_status_idx").on(table.queueDate, table.status),
    check("queue_entries_number_positive", sql`${table.queueNumber} > 0`),
  ],
);

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => testRequests.id, { onDelete: "restrict" }),
    amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
    method: paymentMethod("method").notNull(),
    receiptNumber: varchar("receipt_number", { length: 64 }).notNull().unique(),
    recordedBy: uuid("recorded_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    paidAt: timestamp("paid_at", { withTimezone: true }).defaultNow().notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    index("payments_request_idx").on(table.requestId),
    index("payments_paid_at_idx").on(table.paidAt),
    check("payments_amount_positive", sql`${table.amount} > 0`),
  ],
);

export const specimens = pgTable(
  "specimens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
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
  (table) => [index("specimens_request_idx").on(table.requestId)],
);

export const results = pgTable(
  "results",
  {
    id: uuid("id").defaultRandom().primaryKey(),
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
  (table) => [index("result_reviews_request_time_idx").on(table.requestId, table.reviewedAt)],
);

export const requestStatusHistory = pgTable(
  "request_status_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => testRequests.id, { onDelete: "restrict" }),
    oldStatus: requestStatus("old_status"),
    newStatus: requestStatus("new_status").notNull(),
    changedBy: uuid("changed_by").references(() => users.id, { onDelete: "restrict" }),
    changedAt: timestamp("changed_at", { withTimezone: true }).defaultNow().notNull(),
    note: text("note"),
  },
  (table) => [index("request_status_history_request_time_idx").on(table.requestId, table.changedAt)],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
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
  ],
);
