CREATE TABLE IF NOT EXISTS "gis_maps" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(200) NOT NULL,
  "slug" varchar(120) NOT NULL UNIQUE,
  "original_file" varchar(500) NOT NULL,
  "original_file_name" varchar(255) NOT NULL,
  "file_size_bytes" integer,
  "file_format" varchar(20),
  "status" varchar(40) DEFAULT 'queued' NOT NULL,
  "uploaded_by" uuid REFERENCES "users"("id"),
  "processing_log" jsonb,
  "error_message" text,
  "bbox" jsonb,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "gis_maps_status_idx" ON "gis_maps" ("status");
CREATE INDEX IF NOT EXISTS "gis_maps_uploaded_by_idx" ON "gis_maps" ("uploaded_by");

CREATE TABLE IF NOT EXISTS "gis_layers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "map_id" uuid NOT NULL REFERENCES "gis_maps"("id") ON DELETE CASCADE,
  "table_name" varchar(120) NOT NULL,
  "layer_name" varchar(200) NOT NULL,
  "geometry_type" varchar(40),
  "feature_count" integer DEFAULT 0,
  "bbox" jsonb,
  "visible" boolean DEFAULT true NOT NULL,
  "style_json" jsonb,
  "sort_order" integer DEFAULT 0,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "gis_layers_map_idx" ON "gis_layers" ("map_id");
CREATE INDEX IF NOT EXISTS "gis_layers_table_name_idx" ON "gis_layers" ("table_name");

CREATE TABLE IF NOT EXISTS "gis_layer_features" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "layer_id" uuid NOT NULL REFERENCES "gis_layers"("id") ON DELETE CASCADE,
  "geom" geometry(Geometry, 4326),
  "properties" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "gis_layer_features_layer_idx" ON "gis_layer_features" ("layer_id");
CREATE INDEX IF NOT EXISTS "gis_layer_features_geom_gist" ON "gis_layer_features" USING GIST ("geom");

CREATE TABLE IF NOT EXISTS "gis_processing_jobs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "map_id" uuid NOT NULL REFERENCES "gis_maps"("id") ON DELETE CASCADE,
  "status" varchar(40) DEFAULT 'queued' NOT NULL,
  "progress" integer DEFAULT 0 NOT NULL,
  "message" varchar(500),
  "result" jsonb,
  "error_message" text,
  "started_at" timestamp,
  "completed_at" timestamp,
  "created_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "gis_processing_jobs_map_idx" ON "gis_processing_jobs" ("map_id");
CREATE INDEX IF NOT EXISTS "gis_processing_jobs_status_idx" ON "gis_processing_jobs" ("status");
