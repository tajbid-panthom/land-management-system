ALTER TABLE "mouza_dbf_files" ADD COLUMN IF NOT EXISTS "geojson_cloudinary_public_id" varchar(500);
--> statement-breakpoint
ALTER TABLE "mouza_dbf_files" ADD COLUMN IF NOT EXISTS "geojson_cloudinary_url" varchar(1000);
--> statement-breakpoint
ALTER TABLE "mouza_dbf_files" ADD COLUMN IF NOT EXISTS "geojson_size_bytes" integer;
