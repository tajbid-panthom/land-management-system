ALTER TABLE "land_parcels" ALTER COLUMN "boundary" SET DATA TYPE geometry(Geometry, 4326);--> statement-breakpoint
ALTER TABLE "mouza_gis_features" ALTER COLUMN "boundary" SET DATA TYPE geometry(Geometry, 4326);
