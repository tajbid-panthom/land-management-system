import {
  pgTable,
  uuid,
  varchar,
  pgEnum,
  timestamp,
  boolean,
} from "drizzle-orm/pg-core";

export const documentTypeEnum = pgEnum("document_type", [
  "khatian_copy",
  "mouza_map",
  "plot_map",
  "deed_copy",
  "mutation_certificate",
  "survey_record",
  "gis_map",
  "property_photo",
  "court_document",
  "generated_report",
]);
export const storageProviderEnum = pgEnum("storage_provider", [
  "cloudinary",
  "r2",
]);
export const sensitivityEnum = pgEnum("sensitivity_level", [
  "public",
  "restricted",
  "confidential",
]);

export const documents = pgTable("documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  parcelId: uuid("parcel_id"),
  documentType: documentTypeEnum("document_type").notNull(),
  storageProvider: storageProviderEnum("storage_provider").notNull(),
  storageKey: varchar("storage_key", { length: 500 }).notNull(),
  sensitivityLevel: sensitivityEnum("sensitivity_level").notNull(),
  mimeType: varchar("mime_type", { length: 100 }),
  fileSizeBytes: varchar("file_size_bytes", { length: 20 }),
  uploadedBy: uuid("uploaded_by").notNull(),
  isVerified: boolean("is_verified").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});
