import { pgTable, uuid, varchar, boolean, text } from "drizzle-orm/pg-core";
import { landParcels } from "./parcels";

export const landUse = pgTable("land_use", {
  id: uuid("id").primaryKey().defaultRandom(),
  parcelId: uuid("parcel_id")
    .references(() => landParcels.id)
    .notNull(),
  existingUse: varchar("existing_use", { length: 50 }),
  proposedUse: varchar("proposed_use", { length: 50 }),
  category: varchar("category", { length: 30 }),
  zoningClassification: varchar("zoning_classification", { length: 50 }),
  isProtectedArea: boolean("is_protected_area").default(false),
  wetlandStatus: varchar("wetland_status", { length: 30 }),
  masterPlanRef: varchar("master_plan_ref", { length: 100 }),
  buildingRestrictionZone: varchar("building_restriction_zone", { length: 50 }),
  notes: text("notes"),
});
