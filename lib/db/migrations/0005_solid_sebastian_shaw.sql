CREATE TYPE "public"."mutation_record_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."property_status" AS ENUM('active', 'pending', 'disputed', 'archived');--> statement-breakpoint
CREATE TYPE "public"."transfer_type" AS ENUM('sale', 'gift', 'inheritance', 'partition', 'court_order', 'mutation', 'other');--> statement-breakpoint
ALTER TYPE "public"."role" ADD VALUE 'property_owner' BEFORE 'public_user';--> statement-breakpoint
CREATE TABLE "co_owners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"owner_id" uuid,
	"name" varchar(150) NOT NULL,
	"relationship" varchar(50),
	"ownership_share" numeric(5, 2) NOT NULL,
	"is_current" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "document_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(50) NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "document_categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "download_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid,
	"document_id" uuid,
	"report_id" uuid,
	"user_id" uuid NOT NULL,
	"action" varchar(20) NOT NULL,
	"ip_address" varchar(45),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inheritance_information" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"is_applicable" boolean DEFAULT false NOT NULL,
	"legal_heir" varchar(150),
	"court_order" text,
	"mutation_status" "mutation_record_status" DEFAULT 'pending',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "inheritance_information_property_id_unique" UNIQUE("property_id")
);
--> statement-breakpoint
CREATE TABLE "ownership_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"previous_owner_name" varchar(150) NOT NULL,
	"transfer_date" date NOT NULL,
	"transfer_type" "transfer_type" NOT NULL,
	"sale_amount" numeric(14, 2),
	"recorded_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "planning_information" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"existing_land_use" varchar(50),
	"proposed_land_use" varchar(50),
	"zoning_classification" varchar(50),
	"is_protected_area" boolean DEFAULT false,
	"wetland_status" varchar(30),
	"master_plan_ref" varchar(100),
	"dap_information" text,
	"lap_information" text,
	"building_restriction_zone" varchar(50),
	"updated_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "planning_information_property_id_unique" UNIQUE("property_id")
);
--> statement-breakpoint
CREATE TABLE "properties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parcel_id" uuid NOT NULL,
	"property_code" varchar(30) NOT NULL,
	"qr_code_payload" varchar(500),
	"status" "property_status" DEFAULT 'active' NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "properties_parcel_id_unique" UNIQUE("parcel_id"),
	CONSTRAINT "properties_property_code_unique" UNIQUE("property_code")
);
--> statement-breakpoint
CREATE TABLE "property_deed_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_deed_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"deed_number" varchar(40) NOT NULL,
	"registration_date" date NOT NULL,
	"mutation_case_number" varchar(40),
	"namjari_status" varchar(30),
	"power_of_attorney" text,
	"litigation_status" varchar(50),
	"updated_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "property_deeds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"deed_number" varchar(40) NOT NULL,
	"registration_date" date NOT NULL,
	"mutation_case_number" varchar(40),
	"namjari_status" varchar(30),
	"power_of_attorney" text,
	"litigation_status" varchar(50),
	"updated_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "property_deeds_property_id_unique" UNIQUE("property_id")
);
--> statement-breakpoint
CREATE TABLE "property_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"category_id" uuid,
	"file_name" varchar(255) NOT NULL,
	"storage_key" varchar(500) NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"file_size_bytes" integer NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"uploaded_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "property_locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"division_id" uuid,
	"district_id" uuid,
	"upazila_id" uuid,
	"union_id" uuid,
	"mouza_id" uuid NOT NULL,
	"mouza_name" varchar(100),
	"jl_number" varchar(20),
	"plot_number" varchar(30) NOT NULL,
	"khatian_cs" varchar(30),
	"khatian_sa" varchar(30),
	"khatian_rs" varchar(30),
	"khatian_bs" varchar(30),
	"area_decimal" numeric(12, 4),
	"area_acre" numeric(12, 4),
	"area_hectare" numeric(12, 4),
	"area_sqft" numeric(14, 2),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "property_locations_property_id_unique" UNIQUE("property_id")
);
--> statement-breakpoint
CREATE TABLE "property_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"report_type" varchar(50) NOT NULL,
	"storage_key" varchar(500),
	"status" varchar(30) DEFAULT 'pending' NOT NULL,
	"requested_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "user_owner_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "owners" ADD COLUMN "mother_name" varchar(150);--> statement-breakpoint
ALTER TABLE "owners" ADD COLUMN "date_of_birth" date;--> statement-breakpoint
ALTER TABLE "owners" ADD COLUMN "email" varchar(200);--> statement-breakpoint
ALTER TABLE "owners" ADD COLUMN "created_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "owners" ADD COLUMN "updated_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "owners" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "co_owners" ADD CONSTRAINT "co_owners_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "co_owners" ADD CONSTRAINT "co_owners_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "download_logs" ADD CONSTRAINT "download_logs_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "download_logs" ADD CONSTRAINT "download_logs_document_id_property_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."property_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "download_logs" ADD CONSTRAINT "download_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inheritance_information" ADD CONSTRAINT "inheritance_information_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ownership_history" ADD CONSTRAINT "ownership_history_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ownership_history" ADD CONSTRAINT "ownership_history_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planning_information" ADD CONSTRAINT "planning_information_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planning_information" ADD CONSTRAINT "planning_information_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_parcel_id_land_parcels_id_fk" FOREIGN KEY ("parcel_id") REFERENCES "public"."land_parcels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_deed_versions" ADD CONSTRAINT "property_deed_versions_property_deed_id_property_deeds_id_fk" FOREIGN KEY ("property_deed_id") REFERENCES "public"."property_deeds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_deed_versions" ADD CONSTRAINT "property_deed_versions_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_deeds" ADD CONSTRAINT "property_deeds_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_deeds" ADD CONSTRAINT "property_deeds_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_documents" ADD CONSTRAINT "property_documents_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_documents" ADD CONSTRAINT "property_documents_category_id_document_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."document_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_documents" ADD CONSTRAINT "property_documents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_locations" ADD CONSTRAINT "property_locations_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_locations" ADD CONSTRAINT "property_locations_division_id_divisions_id_fk" FOREIGN KEY ("division_id") REFERENCES "public"."divisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_locations" ADD CONSTRAINT "property_locations_district_id_districts_id_fk" FOREIGN KEY ("district_id") REFERENCES "public"."districts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_locations" ADD CONSTRAINT "property_locations_upazila_id_upazilas_id_fk" FOREIGN KEY ("upazila_id") REFERENCES "public"."upazilas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_locations" ADD CONSTRAINT "property_locations_union_id_unions_id_fk" FOREIGN KEY ("union_id") REFERENCES "public"."unions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_locations" ADD CONSTRAINT "property_locations_mouza_id_mouzas_id_fk" FOREIGN KEY ("mouza_id") REFERENCES "public"."mouzas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_reports" ADD CONSTRAINT "property_reports_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_reports" ADD CONSTRAINT "property_reports_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_owner_links" ADD CONSTRAINT "user_owner_links_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_owner_links" ADD CONSTRAINT "user_owner_links_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "co_owners_property_idx" ON "co_owners" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "co_owners_owner_idx" ON "co_owners" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "download_logs_property_idx" ON "download_logs" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "download_logs_user_idx" ON "download_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ownership_history_property_idx" ON "ownership_history" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "ownership_history_transfer_date_idx" ON "ownership_history" USING btree ("transfer_date");--> statement-breakpoint
CREATE INDEX "properties_status_idx" ON "properties" USING btree ("status");--> statement-breakpoint
CREATE INDEX "properties_deleted_at_idx" ON "properties" USING btree ("deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "properties_code_idx" ON "properties" USING btree ("property_code");--> statement-breakpoint
CREATE INDEX "property_deed_versions_deed_idx" ON "property_deed_versions" USING btree ("property_deed_id");--> statement-breakpoint
CREATE INDEX "property_deeds_number_idx" ON "property_deeds" USING btree ("deed_number");--> statement-breakpoint
CREATE INDEX "property_deeds_registration_date_idx" ON "property_deeds" USING btree ("registration_date");--> statement-breakpoint
CREATE INDEX "property_documents_property_idx" ON "property_documents" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "property_documents_category_idx" ON "property_documents" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "property_locations_mouza_idx" ON "property_locations" USING btree ("mouza_id");--> statement-breakpoint
CREATE INDEX "property_locations_district_idx" ON "property_locations" USING btree ("district_id");--> statement-breakpoint
CREATE INDEX "property_locations_plot_idx" ON "property_locations" USING btree ("plot_number");--> statement-breakpoint
CREATE INDEX "property_locations_jl_idx" ON "property_locations" USING btree ("jl_number");--> statement-breakpoint
CREATE INDEX "property_reports_property_idx" ON "property_reports" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "property_reports_type_idx" ON "property_reports" USING btree ("report_type");--> statement-breakpoint
CREATE UNIQUE INDEX "user_owner_links_unique" ON "user_owner_links" USING btree ("user_id","owner_id");