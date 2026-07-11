ALTER TABLE "mouza_gis_records" ADD COLUMN IF NOT EXISTS "sync_status" varchar(40);
ALTER TABLE "mouza_gis_records" ADD COLUMN IF NOT EXISTS "sync_message" text;

CREATE INDEX IF NOT EXISTS "mouza_gis_records_sync_status_idx"
  ON "mouza_gis_records" ("sync_status");

CREATE INDEX IF NOT EXISTS "mouza_gis_features_boundary_gist"
  ON "mouza_gis_features" USING GIST ("boundary");
