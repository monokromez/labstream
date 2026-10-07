import { pgEnum, pgTable, serial, timestamp, varchar } from "drizzle-orm/pg-core";

// Starter account table; expand this alongside the lab workflow schema.
export const userRole = pgEnum("user_role", [
  "cashier",
  "medical_technologist",
  "pathologist",
  "administrator",
  "patient",
]);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 254 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  role: userRole("role").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
