import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  pgEnum,
  jsonb,
} from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", [
  "super_admin",
  "land_officer",
  "field_verifier",
  "approver",
  "bank_viewer",
  "legal_officer",
  "property_owner",
  "public_user",
]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 200 }).notNull().unique(),
  name: varchar("name", { length: 150 }),
  passwordHash: varchar("password_hash", { length: 255 }),
  role: roleEnum("role").notNull().default("public_user"),
  isActive: varchar("is_active", { length: 5 }).default("true"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  actorUserId: uuid("actor_user_id")
    .references(() => users.id)
    .notNull(),
  action: varchar("action", { length: 50 }).notNull(),
  entityTable: varchar("entity_table", { length: 60 }).notNull(),
  entityId: uuid("entity_id").notNull(),
  previousValue: jsonb("previous_value"),
  newValue: jsonb("new_value"),
  ipAddress: varchar("ip_address", { length: 45 }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const reportJobs = pgTable("report_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  parcelId: uuid("parcel_id").notNull(),
  requestedBy: uuid("requested_by")
    .references(() => users.id)
    .notNull(),
  status: varchar("status", { length: 30 }).notNull().default("pending"),
  documentId: uuid("document_id"),
  errorMessage: varchar("error_message", { length: 500 }),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});
