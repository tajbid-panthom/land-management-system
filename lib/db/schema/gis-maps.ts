import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  integer,
  boolean,
  jsonb,
  text,
  index,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { geometry } from "./geometry";

export const gisMaps = pgTable(
  "gis_maps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 200 }).notNull(),
    slug: varchar("slug", { length: 120 }).notNull().unique(),
    originalFile: varchar("original_file", { length: 500 }).notNull(),
    originalFileName: varchar("original_file_name", { length: 255 }).notNull(),
    fileSizeBytes: integer("file_size_bytes"),
    fileFormat: varchar("file_format", { length: 20 }),
    status: varchar("status", { length: 40 }).default("queued").notNull(),
    uploadedBy: uuid("uploaded_by").references(() => users.id),
    processingLog: jsonb("processing_log").$type<string[]>(),
    errorMessage: text("error_message"),
    bbox: jsonb("bbox").$type<[number, number, number, number]>(),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("gis_maps_status_idx").on(table.status),
    index("gis_maps_uploaded_by_idx").on(table.uploadedBy),
  ],
);

export const gisLayers = pgTable(
  "gis_layers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    mapId: uuid("map_id")
      .references(() => gisMaps.id, { onDelete: "cascade" })
      .notNull(),
    tableName: varchar("table_name", { length: 120 }).notNull(),
    layerName: varchar("layer_name", { length: 200 }).notNull(),
    geometryType: varchar("geometry_type", { length: 40 }),
    featureCount: integer("feature_count").default(0),
    bbox: jsonb("bbox").$type<[number, number, number, number]>(),
    visible: boolean("visible").default(true).notNull(),
    styleJson: jsonb("style_json").$type<Record<string, unknown>>(),
    sortOrder: integer("sort_order").default(0),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("gis_layers_map_idx").on(table.mapId),
    index("gis_layers_table_name_idx").on(table.tableName),
  ],
);

export const gisLayerFeatures = pgTable(
  "gis_layer_features",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    layerId: uuid("layer_id")
      .references(() => gisLayers.id, { onDelete: "cascade" })
      .notNull(),
    geom: geometry("geom"),
    properties: jsonb("properties").notNull().default({}),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [index("gis_layer_features_layer_idx").on(table.layerId)],
);

export const gisProcessingJobs = pgTable(
  "gis_processing_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    mapId: uuid("map_id")
      .references(() => gisMaps.id, { onDelete: "cascade" })
      .notNull(),
    status: varchar("status", { length: 40 }).default("queued").notNull(),
    progress: integer("progress").default(0).notNull(),
    message: varchar("message", { length: 500 }),
    result: jsonb("result"),
    errorMessage: text("error_message"),
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("gis_processing_jobs_map_idx").on(table.mapId),
    index("gis_processing_jobs_status_idx").on(table.status),
  ],
);
