import {
  pgTable,
  uuid,
  varchar,
  numeric,
  date,
  pgEnum,
  text,
} from "drizzle-orm/pg-core";
import { landParcels } from "./parcels";
import { owners } from "./ownership";

export const acquisitionStatusEnum = pgEnum("acquisition_status", [
  "none",
  "proposed",
  "notified",
  "compensation_pending",
  "compensation_paid",
  "completed",
]);
export const mortgageStatusEnum = pgEnum("mortgage_status", [
  "active",
  "released",
  "defaulted",
]);

export const landAcquisition = pgTable("land_acquisition", {
  id: uuid("id").primaryKey().defaultRandom(),
  parcelId: uuid("parcel_id")
    .references(() => landParcels.id)
    .notNull(),
  acquiringAuthority: varchar("acquiring_authority", { length: 150 }),
  purpose: text("purpose"),
  caseNumber: varchar("case_number", { length: 50 }),
  status: acquisitionStatusEnum("status").default("none"),
  compensationAmount: numeric("compensation_amount", {
    precision: 14,
    scale: 2,
  }),
  noticeDate: date("notice_date"),
});

export const mortgages = pgTable("mortgages", {
  id: uuid("id").primaryKey().defaultRandom(),
  parcelId: uuid("parcel_id")
    .references(() => landParcels.id)
    .notNull(),
  bankName: varchar("bank_name", { length: 150 }).notNull(),
  chargeAmount: numeric("charge_amount", { precision: 14, scale: 2 }),
  chargeDate: date("charge_date"),
  releaseDate: date("release_date"),
  status: mortgageStatusEnum("status").default("active"),
});

export const landTransactions = pgTable("land_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  parcelId: uuid("parcel_id")
    .references(() => landParcels.id)
    .notNull(),
  sellerOwnerId: uuid("seller_owner_id").references(() => owners.id),
  buyerOwnerId: uuid("buyer_owner_id").references(() => owners.id),
  transactionType: varchar("transaction_type", { length: 30 }),
  transactionDate: date("transaction_date").notNull(),
  amount: numeric("amount", { precision: 14, scale: 2 }),
  relatedDeedId: uuid("related_deed_id"),
});
