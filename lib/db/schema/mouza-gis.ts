import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  numeric,
  integer,
  boolean,
  jsonb,
  date,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { districts, upazilas, mouzas } from "./geography";
import { landParcels } from "./parcels";
import { polygonGeometry } from "./geometry";
import { users } from "./auth";

export const mouzaGisDatasets = pgTable(
  "mouza_gis_datasets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 150 }).notNull(),
    slug: varchar("slug", { length: 80 }).notNull().unique(),
    districtId: uuid("district_id").references(() => districts.id),
    description: varchar("description", { length: 500 }),
    status: varchar("status", { length: 30 }).default("active").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [index("mouza_gis_datasets_district_idx").on(table.districtId)],
);

export const mouzaGisImports = pgTable(
  "mouza_gis_imports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    datasetId: uuid("dataset_id")
      .references(() => mouzaGisDatasets.id)
      .notNull(),
    fileName: varchar("file_name", { length: 255 }).notNull(),
    importedBy: uuid("imported_by").references(() => users.id),
    recordCount: integer("record_count").default(0),
    successCount: integer("success_count").default(0),
    errorCount: integer("error_count").default(0),
    status: varchar("status", { length: 30 }).default("completed").notNull(),
    errors: jsonb("errors"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [index("mouza_gis_imports_dataset_idx").on(table.datasetId)],
);

/** Excel-imported mouza GIS attribute rows */
export const mouzaGisRecords = pgTable(
  "mouza_gis_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    datasetId: uuid("dataset_id")
      .references(() => mouzaGisDatasets.id)
      .notNull(),
    importId: uuid("import_id").references(() => mouzaGisImports.id),
    plotNo: varchar("plot_no", { length: 50 }),
    mauza: varchar("mauza", { length: 150 }).notNull(),
    jlNo: varchar("jl_no", { length: 30 }).notNull(),
    sheetNo: varchar("sheet_no", { length: 50 }),
    scale: varchar("scale", { length: 50 }),
    revenueNo: varchar("revenue_no", { length: 50 }),
    project: varchar("project", { length: 150 }),
    mzVer: varchar("mz_ver", { length: 30 }),
    mCode: varchar("m_code", { length: 50 }).notNull(),
    layerCode: varchar("layer_code", { length: 50 }),
    layer: varchar("layer", { length: 100 }),
    mDistrict: varchar("m_district", { length: 100 }),
    mUpazila: varchar("m_upazila", { length: 100 }),
    prepDate: date("prep_date"),
    mAcres: numeric("m_acres", { precision: 14, scale: 6 }),
    landType: varchar("land_type", { length: 100 }),
    khasArea: numeric("khas_area", { precision: 14, scale: 6 }),
    landClass: varchar("land_class", { length: 100 }),
    mauzaJlS: varchar("mauza_jl_s", { length: 100 }),
    shapeLeng: numeric("shape_leng", { precision: 18, scale: 8 }),
    shapeArea: numeric("shape_area", { precision: 18, scale: 8 }),
    mouzaId: uuid("mouza_id").references(() => mouzas.id),
    parcelId: uuid("parcel_id").references(() => landParcels.id),
    featureId: uuid("feature_id"),
    mappedAt: timestamp("mapped_at"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("mouza_gis_records_dataset_idx").on(table.datasetId),
    index("mouza_gis_records_m_code_idx").on(table.mCode),
    index("mouza_gis_records_mauza_jl_s_idx").on(table.mauzaJlS),
    index("mouza_gis_records_jl_no_idx").on(table.jlNo),
    index("mouza_gis_records_mauza_idx").on(table.mauza),
    index("mouza_gis_records_plot_no_idx").on(table.plotNo),
    index("mouza_gis_records_mouza_id_idx").on(table.mouzaId),
    uniqueIndex("mouza_gis_records_dataset_plot_key").on(
      table.datasetId,
      table.mCode,
      table.plotNo,
    ),
  ],
);

/** Cloudinary-hosted shapefile archive + derived GeoJSON */
export const mouzaDbfFiles = pgTable(
  "mouza_dbf_files",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    datasetId: uuid("dataset_id")
      .references(() => mouzaGisDatasets.id)
      .notNull(),
    fileName: varchar("file_name", { length: 255 }).notNull(),
    cloudinaryPublicId: varchar("cloudinary_public_id", { length: 500 }).notNull(),
    cloudinaryUrl: varchar("cloudinary_url", { length: 1000 }).notNull(),
    geojsonCloudinaryPublicId: varchar("geojson_cloudinary_public_id", { length: 500 }),
    geojsonCloudinaryUrl: varchar("geojson_cloudinary_url", { length: 1000 }),
    fileSizeBytes: integer("file_size_bytes"),
    geojsonSizeBytes: integer("geojson_size_bytes"),
    format: varchar("format", { length: 20 }),
    version: integer("version").default(1).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    fieldNames: jsonb("field_names"),
    recordCount: integer("record_count").default(0),
    uploadedBy: uuid("uploaded_by").references(() => users.id),
    uploadedAt: timestamp("uploaded_at").defaultNow(),
  },
  (table) => [
    index("mouza_dbf_files_dataset_idx").on(table.datasetId),
    index("mouza_dbf_files_active_idx").on(table.datasetId, table.isActive),
  ],
);

/** Parsed GIS features with geometry from shapefile */
export const mouzaGisFeatures = pgTable(
  "mouza_gis_features",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    datasetId: uuid("dataset_id")
      .references(() => mouzaGisDatasets.id)
      .notNull(),
    dbfFileId: uuid("dbf_file_id")
      .references(() => mouzaDbfFiles.id)
      .notNull(),
    mCode: varchar("m_code", { length: 50 }),
    mauzaJlS: varchar("mauza_jl_s", { length: 100 }),
    jlNo: varchar("jl_no", { length: 30 }),
    plotNo: varchar("plot_no", { length: 50 }),
    mauza: varchar("mauza", { length: 150 }),
    dbfAttributes: jsonb("dbf_attributes").notNull(),
    boundary: polygonGeometry("boundary"),
    gisRecordId: uuid("gis_record_id").references(() => mouzaGisRecords.id),
    mappedAt: timestamp("mapped_at"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("mouza_gis_features_dataset_idx").on(table.datasetId),
    index("mouza_gis_features_dbf_idx").on(table.dbfFileId),
    index("mouza_gis_features_m_code_idx").on(table.mCode),
    index("mouza_gis_features_mauza_jl_s_idx").on(table.mauzaJlS),
    index("mouza_gis_features_gis_record_idx").on(table.gisRecordId),
  ],
);
