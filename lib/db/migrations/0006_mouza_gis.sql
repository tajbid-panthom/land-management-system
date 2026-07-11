-- Mouza GIS schema for Dhaka North and future districts

ALTER TABLE "mouzas" ALTER COLUMN "union_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "mouzas" ADD COLUMN IF NOT EXISTS "upazila_id" uuid;
--> statement-breakpoint
ALTER TABLE "mouzas" ADD COLUMN IF NOT EXISTS "m_code" varchar(50);
--> statement-breakpoint
ALTER TABLE "mouzas" ADD COLUMN IF NOT EXISTS "dataset_id" uuid;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "mouzas" ADD CONSTRAINT "mouzas_upazila_id_upazilas_id_fk" FOREIGN KEY ("upazila_id") REFERENCES "public"."upazilas"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mouzas_upazila_id_idx" ON "mouzas" USING btree ("upazila_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mouzas_m_code_idx" ON "mouzas" USING btree ("m_code");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mouzas_jl_number_idx" ON "mouzas" USING btree ("jl_number");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "mouza_gis_datasets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(150) NOT NULL,
  "slug" varchar(80) NOT NULL UNIQUE,
  "district_id" uuid,
  "description" varchar(500),
  "status" varchar(30) DEFAULT 'active' NOT NULL,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "mouza_gis_imports" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "dataset_id" uuid NOT NULL,
  "file_name" varchar(255) NOT NULL,
  "imported_by" uuid,
  "record_count" integer DEFAULT 0,
  "success_count" integer DEFAULT 0,
  "error_count" integer DEFAULT 0,
  "status" varchar(30) DEFAULT 'completed' NOT NULL,
  "errors" jsonb,
  "created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "mouza_gis_records" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "dataset_id" uuid NOT NULL,
  "import_id" uuid,
  "plot_no" varchar(50),
  "mauza" varchar(150) NOT NULL,
  "jl_no" varchar(30) NOT NULL,
  "sheet_no" varchar(50),
  "scale" varchar(50),
  "revenue_no" varchar(50),
  "project" varchar(150),
  "mz_ver" varchar(30),
  "m_code" varchar(50) NOT NULL,
  "layer_code" varchar(50),
  "layer" varchar(100),
  "m_district" varchar(100),
  "m_upazila" varchar(100),
  "prep_date" date,
  "m_acres" numeric(14, 6),
  "land_type" varchar(100),
  "khas_area" numeric(14, 6),
  "land_class" varchar(100),
  "mauza_jl_s" varchar(100),
  "shape_leng" numeric(18, 8),
  "shape_area" numeric(18, 8),
  "mouza_id" uuid,
  "parcel_id" uuid,
  "feature_id" uuid,
  "mapped_at" timestamp,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "mouza_dbf_files" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "dataset_id" uuid NOT NULL,
  "file_name" varchar(255) NOT NULL,
  "cloudinary_public_id" varchar(500) NOT NULL,
  "cloudinary_url" varchar(1000) NOT NULL,
  "file_size_bytes" integer,
  "format" varchar(20),
  "version" integer DEFAULT 1 NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "field_names" jsonb,
  "record_count" integer DEFAULT 0,
  "uploaded_by" uuid,
  "uploaded_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "mouza_gis_features" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "dataset_id" uuid NOT NULL,
  "dbf_file_id" uuid NOT NULL,
  "m_code" varchar(50),
  "mauza_jl_s" varchar(100),
  "jl_no" varchar(30),
  "plot_no" varchar(50),
  "mauza" varchar(150),
  "dbf_attributes" jsonb NOT NULL,
  "boundary" geometry(Polygon, 4326),
  "gis_record_id" uuid,
  "mapped_at" timestamp,
  "created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "mouza_gis_datasets" ADD CONSTRAINT "mouza_gis_datasets_district_id_districts_id_fk" FOREIGN KEY ("district_id") REFERENCES "public"."districts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "mouza_gis_imports" ADD CONSTRAINT "mouza_gis_imports_dataset_id_mouza_gis_datasets_id_fk" FOREIGN KEY ("dataset_id") REFERENCES "public"."mouza_gis_datasets"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "mouza_gis_imports" ADD CONSTRAINT "mouza_gis_imports_imported_by_users_id_fk" FOREIGN KEY ("imported_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "mouza_gis_records" ADD CONSTRAINT "mouza_gis_records_dataset_id_mouza_gis_datasets_id_fk" FOREIGN KEY ("dataset_id") REFERENCES "public"."mouza_gis_datasets"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "mouza_gis_records" ADD CONSTRAINT "mouza_gis_records_import_id_mouza_gis_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."mouza_gis_imports"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "mouza_gis_records" ADD CONSTRAINT "mouza_gis_records_mouza_id_mouzas_id_fk" FOREIGN KEY ("mouza_id") REFERENCES "public"."mouzas"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "mouza_gis_records" ADD CONSTRAINT "mouza_gis_records_parcel_id_land_parcels_id_fk" FOREIGN KEY ("parcel_id") REFERENCES "public"."land_parcels"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "mouza_dbf_files" ADD CONSTRAINT "mouza_dbf_files_dataset_id_mouza_gis_datasets_id_fk" FOREIGN KEY ("dataset_id") REFERENCES "public"."mouza_gis_datasets"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "mouza_dbf_files" ADD CONSTRAINT "mouza_dbf_files_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "mouza_gis_features" ADD CONSTRAINT "mouza_gis_features_dataset_id_mouza_gis_datasets_id_fk" FOREIGN KEY ("dataset_id") REFERENCES "public"."mouza_gis_datasets"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "mouza_gis_features" ADD CONSTRAINT "mouza_gis_features_dbf_file_id_mouza_dbf_files_id_fk" FOREIGN KEY ("dbf_file_id") REFERENCES "public"."mouza_dbf_files"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "mouza_gis_features" ADD CONSTRAINT "mouza_gis_features_gis_record_id_mouza_gis_records_id_fk" FOREIGN KEY ("gis_record_id") REFERENCES "public"."mouza_gis_records"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mouza_gis_datasets_district_idx" ON "mouza_gis_datasets" USING btree ("district_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mouza_gis_imports_dataset_idx" ON "mouza_gis_imports" USING btree ("dataset_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mouza_gis_records_dataset_idx" ON "mouza_gis_records" USING btree ("dataset_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mouza_gis_records_m_code_idx" ON "mouza_gis_records" USING btree ("m_code");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mouza_gis_records_mauza_jl_s_idx" ON "mouza_gis_records" USING btree ("mauza_jl_s");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mouza_gis_records_jl_no_idx" ON "mouza_gis_records" USING btree ("jl_no");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mouza_gis_records_mauza_idx" ON "mouza_gis_records" USING btree ("mauza");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mouza_gis_records_plot_no_idx" ON "mouza_gis_records" USING btree ("plot_no");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mouza_gis_records_mouza_id_idx" ON "mouza_gis_records" USING btree ("mouza_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "mouza_gis_records_dataset_plot_key" ON "mouza_gis_records" USING btree ("dataset_id","m_code","plot_no");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mouza_dbf_files_dataset_idx" ON "mouza_dbf_files" USING btree ("dataset_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mouza_dbf_files_active_idx" ON "mouza_dbf_files" USING btree ("dataset_id","is_active");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mouza_gis_features_dataset_idx" ON "mouza_gis_features" USING btree ("dataset_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mouza_gis_features_dbf_idx" ON "mouza_gis_features" USING btree ("dbf_file_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mouza_gis_features_m_code_idx" ON "mouza_gis_features" USING btree ("m_code");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mouza_gis_features_mauza_jl_s_idx" ON "mouza_gis_features" USING btree ("mauza_jl_s");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mouza_gis_features_gis_record_idx" ON "mouza_gis_features" USING btree ("gis_record_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mouza_gis_features_boundary_idx" ON "mouza_gis_features" USING gist ("boundary");
