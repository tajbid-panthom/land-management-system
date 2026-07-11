import {
  pgTable,
  uuid,
  varchar,
  numeric,
  timestamp,
  pgEnum,
  text,
  boolean,
  date,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { landParcels } from "./parcels";
import { owners } from "./ownership";
import { users } from "./auth";
import {
  divisions,
  districts,
  upazilas,
  unions,
  mouzas,
} from "./geography";

export const propertyStatusEnum = pgEnum("property_status", [
  "active",
  "pending",
  "disputed",
  "archived",
]);

export const mutationRecordStatusEnum = pgEnum("mutation_record_status", [
  "pending",
  "approved",
  "rejected",
]);

export const transferTypeEnum = pgEnum("transfer_type", [
  "sale",
  "gift",
  "inheritance",
  "partition",
  "court_order",
  "mutation",
  "other",
]);

export const properties = pgTable(
  "properties",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    parcelId: uuid("parcel_id")
      .references(() => landParcels.id)
      .notNull()
      .unique(),
    propertyCode: varchar("property_code", { length: 30 }).notNull().unique(),
    qrCodePayload: varchar("qr_code_payload", { length: 500 }),
    status: propertyStatusEnum("status").default("active").notNull(),
    createdBy: uuid("created_by").references(() => users.id),
    updatedBy: uuid("updated_by").references(() => users.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => [
    index("properties_status_idx").on(table.status),
    index("properties_deleted_at_idx").on(table.deletedAt),
    uniqueIndex("properties_code_idx").on(table.propertyCode),
  ],
);

export const propertyLocations = pgTable(
  "property_locations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id")
      .references(() => properties.id)
      .notNull()
      .unique(),
    divisionId: uuid("division_id").references(() => divisions.id),
    districtId: uuid("district_id").references(() => districts.id),
    upazilaId: uuid("upazila_id").references(() => upazilas.id),
    unionId: uuid("union_id").references(() => unions.id),
    mouzaId: uuid("mouza_id")
      .references(() => mouzas.id)
      .notNull(),
    mouzaName: varchar("mouza_name", { length: 100 }),
    jlNumber: varchar("jl_number", { length: 20 }),
    plotNumber: varchar("plot_number", { length: 30 }).notNull(),
    khatianCs: varchar("khatian_cs", { length: 30 }),
    khatianSa: varchar("khatian_sa", { length: 30 }),
    khatianRs: varchar("khatian_rs", { length: 30 }),
    khatianBs: varchar("khatian_bs", { length: 30 }),
    areaDecimal: numeric("area_decimal", { precision: 12, scale: 4 }),
    areaAcre: numeric("area_acre", { precision: 12, scale: 4 }),
    areaHectare: numeric("area_hectare", { precision: 12, scale: 4 }),
    areaSqft: numeric("area_sqft", { precision: 14, scale: 2 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => [
    index("property_locations_mouza_idx").on(table.mouzaId),
    index("property_locations_district_idx").on(table.districtId),
    index("property_locations_plot_idx").on(table.plotNumber),
    index("property_locations_jl_idx").on(table.jlNumber),
  ],
);

export const propertyDeeds = pgTable(
  "property_deeds",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id")
      .references(() => properties.id)
      .notNull()
      .unique(),
    deedNumber: varchar("deed_number", { length: 40 }).notNull(),
    registrationDate: date("registration_date").notNull(),
    mutationCaseNumber: varchar("mutation_case_number", { length: 40 }),
    namjariStatus: varchar("namjari_status", { length: 30 }),
    powerOfAttorney: text("power_of_attorney"),
    litigationStatus: varchar("litigation_status", { length: 50 }),
    updatedBy: uuid("updated_by").references(() => users.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => [
    index("property_deeds_number_idx").on(table.deedNumber),
    index("property_deeds_registration_date_idx").on(table.registrationDate),
  ],
);

export const propertyDeedVersions = pgTable(
  "property_deed_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyDeedId: uuid("property_deed_id")
      .references(() => propertyDeeds.id)
      .notNull(),
    version: integer("version").notNull(),
    deedNumber: varchar("deed_number", { length: 40 }).notNull(),
    registrationDate: date("registration_date").notNull(),
    mutationCaseNumber: varchar("mutation_case_number", { length: 40 }),
    namjariStatus: varchar("namjari_status", { length: 30 }),
    powerOfAttorney: text("power_of_attorney"),
    litigationStatus: varchar("litigation_status", { length: 50 }),
    updatedBy: uuid("updated_by").references(() => users.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("property_deed_versions_deed_idx").on(table.propertyDeedId),
  ],
);

export const ownershipHistory = pgTable(
  "ownership_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id")
      .references(() => properties.id)
      .notNull(),
    previousOwnerName: varchar("previous_owner_name", { length: 150 }).notNull(),
    transferDate: date("transfer_date").notNull(),
    transferType: transferTypeEnum("transfer_type").notNull(),
    saleAmount: numeric("sale_amount", { precision: 14, scale: 2 }),
    recordedBy: uuid("recorded_by").references(() => users.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => [
    index("ownership_history_property_idx").on(table.propertyId),
    index("ownership_history_transfer_date_idx").on(table.transferDate),
  ],
);

export const coOwners = pgTable(
  "co_owners",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id")
      .references(() => properties.id)
      .notNull(),
    ownerId: uuid("owner_id").references(() => owners.id),
    name: varchar("name", { length: 150 }).notNull(),
    relationship: varchar("relationship", { length: 50 }),
    ownershipShare: numeric("ownership_share", {
      precision: 5,
      scale: 2,
    }).notNull(),
    isCurrent: boolean("is_current").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => [
    index("co_owners_property_idx").on(table.propertyId),
    index("co_owners_owner_idx").on(table.ownerId),
  ],
);

export const inheritanceInformation = pgTable(
  "inheritance_information",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id")
      .references(() => properties.id)
      .notNull()
      .unique(),
    isApplicable: boolean("is_applicable").default(false).notNull(),
    legalHeir: varchar("legal_heir", { length: 150 }),
    courtOrder: text("court_order"),
    mutationStatus: mutationRecordStatusEnum("mutation_status").default(
      "pending",
    ),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
  },
);

export const planningInformation = pgTable(
  "planning_information",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id")
      .references(() => properties.id)
      .notNull()
      .unique(),
    existingLandUse: varchar("existing_land_use", { length: 50 }),
    proposedLandUse: varchar("proposed_land_use", { length: 50 }),
    zoningClassification: varchar("zoning_classification", { length: 50 }),
    isProtectedArea: boolean("is_protected_area").default(false),
    wetlandStatus: varchar("wetland_status", { length: 30 }),
    masterPlanRef: varchar("master_plan_ref", { length: 100 }),
    dapInformation: text("dap_information"),
    lapInformation: text("lap_information"),
    buildingRestrictionZone: varchar("building_restriction_zone", { length: 50 }),
    updatedBy: uuid("updated_by").references(() => users.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
  },
);

export const documentCategories = pgTable("document_categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: varchar("slug", { length: 50 }).notNull().unique(),
  name: varchar("name", { length: 100 }).notNull(),
  description: varchar("description", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const propertyDocuments = pgTable(
  "property_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id")
      .references(() => properties.id)
      .notNull(),
    categoryId: uuid("category_id").references(() => documentCategories.id),
    fileName: varchar("file_name", { length: 255 }).notNull(),
    storageKey: varchar("storage_key", { length: 500 }).notNull(),
    mimeType: varchar("mime_type", { length: 100 }).notNull(),
    fileSizeBytes: integer("file_size_bytes").notNull(),
    version: integer("version").default(1).notNull(),
    uploadedBy: uuid("uploaded_by")
      .references(() => users.id)
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => [
    index("property_documents_property_idx").on(table.propertyId),
    index("property_documents_category_idx").on(table.categoryId),
  ],
);

export const downloadLogs = pgTable(
  "download_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id").references(() => properties.id),
    documentId: uuid("document_id").references(() => propertyDocuments.id),
    reportId: uuid("report_id"),
    userId: uuid("user_id")
      .references(() => users.id)
      .notNull(),
    action: varchar("action", { length: 20 }).notNull(),
    ipAddress: varchar("ip_address", { length: 45 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("download_logs_property_idx").on(table.propertyId),
    index("download_logs_user_idx").on(table.userId),
  ],
);

export const propertyReports = pgTable(
  "property_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id")
      .references(() => properties.id)
      .notNull(),
    reportType: varchar("report_type", { length: 50 }).notNull(),
    storageKey: varchar("storage_key", { length: 500 }),
    status: varchar("status", { length: 30 }).default("pending").notNull(),
    requestedBy: uuid("requested_by")
      .references(() => users.id)
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    completedAt: timestamp("completed_at"),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => [
    index("property_reports_property_idx").on(table.propertyId),
    index("property_reports_type_idx").on(table.reportType),
  ],
);

export const userOwnerLinks = pgTable(
  "user_owner_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id)
      .notNull(),
    ownerId: uuid("owner_id")
      .references(() => owners.id)
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("user_owner_links_unique").on(table.userId, table.ownerId),
  ],
);
