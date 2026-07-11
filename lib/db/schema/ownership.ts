import {
  pgTable,
  uuid,
  varchar,
  numeric,
  date,
  pgEnum,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";
import { landParcels } from "./parcels";

export const verificationStatusEnum = pgEnum("verification_status", [
  "pending",
  "under_review",
  "verified",
  "rejected",
  "disputed",
]);

export const owners = pgTable("owners", {
  id: uuid("id").primaryKey().defaultRandom(),
  fullName: varchar("full_name", { length: 150 }).notNull(),
  fatherOrHusbandName: varchar("father_husband_name", { length: 150 }),
  motherName: varchar("mother_name", { length: 150 }),
  dateOfBirth: date("date_of_birth"),
  nidNumberEncrypted: varchar("nid_number_encrypted", { length: 255 }),
  phone: varchar("phone", { length: 20 }),
  email: varchar("email", { length: 200 }),
  address: varchar("address", { length: 300 }),
  photoUrl: varchar("photo_url", { length: 500 }),
  ownerType: varchar("owner_type", { length: 20 }).default("individual"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  deletedAt: timestamp("deleted_at"),
});

export const ownershipRecords = pgTable("ownership_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  parcelId: uuid("parcel_id")
    .references(() => landParcels.id)
    .notNull(),
  ownerId: uuid("owner_id")
    .references(() => owners.id)
    .notNull(),
  sharePercentage: numeric("share_percentage", {
    precision: 5,
    scale: 2,
  }).notNull(),
  acquisitionMethod: varchar("acquisition_method", { length: 30 }),
  effectiveFrom: date("effective_from").notNull(),
  effectiveTo: date("effective_to"),
  isCurrent: boolean("is_current").default(true),
  verificationStatus: verificationStatusEnum("verification_status").default(
    "pending",
  ),
  createdAt: timestamp("created_at").defaultNow(),
});

export const inheritanceRecords = pgTable("inheritance_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  deceasedOwnerId: uuid("deceased_owner_id")
    .references(() => owners.id)
    .notNull(),
  heirOwnerId: uuid("heir_owner_id")
    .references(() => owners.id)
    .notNull(),
  parcelId: uuid("parcel_id")
    .references(() => landParcels.id)
    .notNull(),
  relationToDeceased: varchar("relation", { length: 50 }),
  inheritanceDeedDocId: uuid("inheritance_deed_doc_id"),
  sharePercentage: numeric("share_percentage", { precision: 5, scale: 2 }),
});
