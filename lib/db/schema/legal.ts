import {
  pgTable,
  uuid,
  varchar,
  date,
  pgEnum,
  timestamp,
  text,
  boolean,
} from "drizzle-orm/pg-core";
import { landParcels } from "./parcels";
import { owners } from "./ownership";

export const mutationStatusEnum = pgEnum("mutation_status", [
  "not_applied",
  "applied",
  "under_hearing",
  "approved",
  "rejected",
]);
export const caseStatusEnum = pgEnum("case_status", [
  "ongoing",
  "resolved",
  "dismissed",
  "stayed",
]);

export const deeds = pgTable("deeds", {
  id: uuid("id").primaryKey().defaultRandom(),
  parcelId: uuid("parcel_id")
    .references(() => landParcels.id)
    .notNull(),
  deedNumber: varchar("deed_number", { length: 40 }).notNull(),
  deedType: varchar("deed_type", { length: 30 }),
  registrationDate: date("registration_date").notNull(),
  registrationOffice: varchar("registration_office", { length: 150 }),
  granteeOwnerId: uuid("grantee_owner_id").references(() => owners.id),
  grantorOwnerId: uuid("grantor_owner_id").references(() => owners.id),
  deedDocumentId: uuid("deed_document_id"),
});

export const mutationCases = pgTable("mutation_cases", {
  id: uuid("id").primaryKey().defaultRandom(),
  parcelId: uuid("parcel_id")
    .references(() => landParcels.id)
    .notNull(),
  caseNumber: varchar("case_number", { length: 40 }).notNull(),
  status: mutationStatusEnum("status").default("not_applied"),
  namjariStatus: varchar("namjari_status", { length: 30 }),
  appliedDate: date("applied_date"),
  decisionDate: date("decision_date"),
  approvedBy: uuid("approved_by"),
  remarks: text("remarks"),
});

export const powerOfAttorney = pgTable("power_of_attorney", {
  id: uuid("id").primaryKey().defaultRandom(),
  parcelId: uuid("parcel_id")
    .references(() => landParcels.id)
    .notNull(),
  grantorOwnerId: uuid("grantor_owner_id")
    .references(() => owners.id)
    .notNull(),
  attorneyHolderOwnerId: uuid("attorney_holder_owner_id")
    .references(() => owners.id)
    .notNull(),
  scope: text("scope"),
  validFrom: date("valid_from"),
  validTo: date("valid_to"),
  documentId: uuid("document_id"),
  isRevoked: boolean("is_revoked").default(false),
});

export const courtCases = pgTable("court_cases", {
  id: uuid("id").primaryKey().defaultRandom(),
  parcelId: uuid("parcel_id")
    .references(() => landParcels.id)
    .notNull(),
  caseNumber: varchar("case_number", { length: 50 }).notNull(),
  courtName: varchar("court_name", { length: 150 }),
  caseType: varchar("case_type", { length: 50 }),
  status: caseStatusEnum("status").default("ongoing"),
  filedDate: date("filed_date"),
  verdictDate: date("verdict_date"),
  verdictSummary: text("verdict_summary"),
});
