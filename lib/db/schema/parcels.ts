import {
  pgTable,
  uuid,
  varchar,
  numeric,
  timestamp,
  pgEnum,
  jsonb,
} from "drizzle-orm/pg-core";
import { mouzas } from "./geography";
import { geometry } from "./geometry";

export const khatianTypeEnum = pgEnum("khatian_type", ["CS", "SA", "RS", "BS"]);
export const areaUnitEnum = pgEnum("area_unit", [
  "decimal",
  "acre",
  "hectare",
  "sqft",
  "katha",
  "bigha",
]);

export const landParcels = pgTable("land_parcels", {
  id: uuid("id").primaryKey().defaultRandom(),
  mouzaId: uuid("mouza_id")
    .references(() => mouzas.id)
    .notNull(),
  plotNumber: varchar("plot_number", { length: 30 }).notNull(),
  areaValue: numeric("area_value", { precision: 12, scale: 4 }).notNull(),
  areaUnit: areaUnitEnum("area_unit").notNull(),
  boundary: geometry("boundary"),
  currentUseId: uuid("current_use_id"),
  status: varchar("status", { length: 30 }).default("active"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const khatians = pgTable("khatians", {
  id: uuid("id").primaryKey().defaultRandom(),
  parcelId: uuid("parcel_id")
    .references(() => landParcels.id)
    .notNull(),
  khatianType: khatianTypeEnum("khatian_type").notNull(),
  khatianNumber: varchar("khatian_number", { length: 30 }).notNull(),
  issuedAt: timestamp("issued_at"),
  remarks: jsonb("remarks"),
});
