CREATE TYPE "public"."area_unit" AS ENUM('decimal', 'acre', 'hectare', 'sqft', 'katha', 'bigha');--> statement-breakpoint
CREATE TYPE "public"."khatian_type" AS ENUM('CS', 'SA', 'RS', 'BS');--> statement-breakpoint
CREATE TYPE "public"."verification_status" AS ENUM('pending', 'under_review', 'verified', 'rejected', 'disputed');--> statement-breakpoint
CREATE TYPE "public"."case_status" AS ENUM('ongoing', 'resolved', 'dismissed', 'stayed');--> statement-breakpoint
CREATE TYPE "public"."mutation_status" AS ENUM('not_applied', 'applied', 'under_hearing', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."document_type" AS ENUM('khatian_copy', 'mouza_map', 'plot_map', 'deed_copy', 'mutation_certificate', 'survey_record', 'gis_map', 'property_photo', 'court_document', 'generated_report');--> statement-breakpoint
CREATE TYPE "public"."sensitivity_level" AS ENUM('public', 'restricted', 'confidential');--> statement-breakpoint
CREATE TYPE "public"."storage_provider" AS ENUM('cloudinary', 'r2');--> statement-breakpoint
CREATE TYPE "public"."acquisition_status" AS ENUM('none', 'proposed', 'notified', 'compensation_pending', 'compensation_paid', 'completed');--> statement-breakpoint
CREATE TYPE "public"."mortgage_status" AS ENUM('active', 'released', 'defaulted');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('super_admin', 'land_officer', 'field_verifier', 'approver', 'bank_viewer', 'legal_officer', 'public_user');--> statement-breakpoint
CREATE TABLE "districts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"name_bn" varchar(100),
	"code" varchar(20) NOT NULL,
	CONSTRAINT "districts_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "mouzas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"union_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"name_bn" varchar(100),
	"jl_number" varchar(20) NOT NULL,
	"boundary" geometry(Geometry, 4326),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "unions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"upazila_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"type" varchar(30) NOT NULL,
	"code" varchar(20)
);
--> statement-breakpoint
CREATE TABLE "upazilas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"district_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"name_bn" varchar(100),
	"code" varchar(20) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "khatians" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parcel_id" uuid NOT NULL,
	"khatian_type" "khatian_type" NOT NULL,
	"khatian_number" varchar(30) NOT NULL,
	"issued_at" timestamp,
	"remarks" jsonb
);
--> statement-breakpoint
CREATE TABLE "land_parcels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mouza_id" uuid NOT NULL,
	"plot_number" varchar(30) NOT NULL,
	"area_value" numeric(12, 4) NOT NULL,
	"area_unit" "area_unit" NOT NULL,
	"boundary" geometry(Polygon, 4326),
	"current_use_id" uuid,
	"status" varchar(30) DEFAULT 'active',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "inheritance_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deceased_owner_id" uuid NOT NULL,
	"heir_owner_id" uuid NOT NULL,
	"parcel_id" uuid NOT NULL,
	"relation" varchar(50),
	"inheritance_deed_doc_id" uuid,
	"share_percentage" numeric(5, 2)
);
--> statement-breakpoint
CREATE TABLE "owners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"full_name" varchar(150) NOT NULL,
	"father_husband_name" varchar(150),
	"nid_number_encrypted" varchar(255),
	"phone" varchar(20),
	"address" varchar(300),
	"photo_url" varchar(500),
	"owner_type" varchar(20) DEFAULT 'individual'
);
--> statement-breakpoint
CREATE TABLE "ownership_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parcel_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"share_percentage" numeric(5, 2) NOT NULL,
	"acquisition_method" varchar(30),
	"effective_from" date NOT NULL,
	"effective_to" date,
	"is_current" boolean DEFAULT true,
	"verification_status" "verification_status" DEFAULT 'pending',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "court_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parcel_id" uuid NOT NULL,
	"case_number" varchar(50) NOT NULL,
	"court_name" varchar(150),
	"case_type" varchar(50),
	"status" "case_status" DEFAULT 'ongoing',
	"filed_date" date,
	"verdict_date" date,
	"verdict_summary" text
);
--> statement-breakpoint
CREATE TABLE "deeds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parcel_id" uuid NOT NULL,
	"deed_number" varchar(40) NOT NULL,
	"deed_type" varchar(30),
	"registration_date" date NOT NULL,
	"registration_office" varchar(150),
	"grantee_owner_id" uuid,
	"grantor_owner_id" uuid,
	"deed_document_id" uuid
);
--> statement-breakpoint
CREATE TABLE "mutation_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parcel_id" uuid NOT NULL,
	"case_number" varchar(40) NOT NULL,
	"status" "mutation_status" DEFAULT 'not_applied',
	"namjari_status" varchar(30),
	"applied_date" date,
	"decision_date" date,
	"approved_by" uuid,
	"remarks" text
);
--> statement-breakpoint
CREATE TABLE "power_of_attorney" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parcel_id" uuid NOT NULL,
	"grantor_owner_id" uuid NOT NULL,
	"attorney_holder_owner_id" uuid NOT NULL,
	"scope" text,
	"valid_from" date,
	"valid_to" date,
	"document_id" uuid,
	"is_revoked" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "land_use" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parcel_id" uuid NOT NULL,
	"existing_use" varchar(50),
	"proposed_use" varchar(50),
	"category" varchar(30),
	"zoning_classification" varchar(50),
	"is_protected_area" boolean DEFAULT false,
	"wetland_status" varchar(30),
	"master_plan_ref" varchar(100),
	"building_restriction_zone" varchar(50),
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parcel_id" uuid,
	"document_type" "document_type" NOT NULL,
	"storage_provider" "storage_provider" NOT NULL,
	"storage_key" varchar(500) NOT NULL,
	"sensitivity_level" "sensitivity_level" NOT NULL,
	"mime_type" varchar(100),
	"file_size_bytes" varchar(20),
	"uploaded_by" uuid NOT NULL,
	"is_verified" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "land_acquisition" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parcel_id" uuid NOT NULL,
	"acquiring_authority" varchar(150),
	"purpose" text,
	"case_number" varchar(50),
	"status" "acquisition_status" DEFAULT 'none',
	"compensation_amount" numeric(14, 2),
	"notice_date" date
);
--> statement-breakpoint
CREATE TABLE "land_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parcel_id" uuid NOT NULL,
	"seller_owner_id" uuid,
	"buyer_owner_id" uuid,
	"transaction_type" varchar(30),
	"transaction_date" date NOT NULL,
	"amount" numeric(14, 2),
	"related_deed_id" uuid
);
--> statement-breakpoint
CREATE TABLE "mortgages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parcel_id" uuid NOT NULL,
	"bank_name" varchar(150) NOT NULL,
	"charge_amount" numeric(14, 2),
	"charge_date" date,
	"release_date" date,
	"status" "mortgage_status" DEFAULT 'active'
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" uuid NOT NULL,
	"action" varchar(50) NOT NULL,
	"entity_table" varchar(60) NOT NULL,
	"entity_id" uuid NOT NULL,
	"previous_value" jsonb,
	"new_value" jsonb,
	"ip_address" varchar(45),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "report_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parcel_id" uuid NOT NULL,
	"requested_by" uuid NOT NULL,
	"status" varchar(30) DEFAULT 'pending' NOT NULL,
	"document_id" uuid,
	"error_message" varchar(500),
	"created_at" timestamp DEFAULT now(),
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(200) NOT NULL,
	"name" varchar(150),
	"password_hash" varchar(255),
	"role" "role" DEFAULT 'public_user' NOT NULL,
	"is_active" varchar(5) DEFAULT 'true',
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "mouzas" ADD CONSTRAINT "mouzas_union_id_unions_id_fk" FOREIGN KEY ("union_id") REFERENCES "public"."unions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unions" ADD CONSTRAINT "unions_upazila_id_upazilas_id_fk" FOREIGN KEY ("upazila_id") REFERENCES "public"."upazilas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "upazilas" ADD CONSTRAINT "upazilas_district_id_districts_id_fk" FOREIGN KEY ("district_id") REFERENCES "public"."districts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "khatians" ADD CONSTRAINT "khatians_parcel_id_land_parcels_id_fk" FOREIGN KEY ("parcel_id") REFERENCES "public"."land_parcels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "land_parcels" ADD CONSTRAINT "land_parcels_mouza_id_mouzas_id_fk" FOREIGN KEY ("mouza_id") REFERENCES "public"."mouzas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inheritance_records" ADD CONSTRAINT "inheritance_records_deceased_owner_id_owners_id_fk" FOREIGN KEY ("deceased_owner_id") REFERENCES "public"."owners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inheritance_records" ADD CONSTRAINT "inheritance_records_heir_owner_id_owners_id_fk" FOREIGN KEY ("heir_owner_id") REFERENCES "public"."owners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inheritance_records" ADD CONSTRAINT "inheritance_records_parcel_id_land_parcels_id_fk" FOREIGN KEY ("parcel_id") REFERENCES "public"."land_parcels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ownership_records" ADD CONSTRAINT "ownership_records_parcel_id_land_parcels_id_fk" FOREIGN KEY ("parcel_id") REFERENCES "public"."land_parcels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ownership_records" ADD CONSTRAINT "ownership_records_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "court_cases" ADD CONSTRAINT "court_cases_parcel_id_land_parcels_id_fk" FOREIGN KEY ("parcel_id") REFERENCES "public"."land_parcels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deeds" ADD CONSTRAINT "deeds_parcel_id_land_parcels_id_fk" FOREIGN KEY ("parcel_id") REFERENCES "public"."land_parcels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deeds" ADD CONSTRAINT "deeds_grantee_owner_id_owners_id_fk" FOREIGN KEY ("grantee_owner_id") REFERENCES "public"."owners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deeds" ADD CONSTRAINT "deeds_grantor_owner_id_owners_id_fk" FOREIGN KEY ("grantor_owner_id") REFERENCES "public"."owners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mutation_cases" ADD CONSTRAINT "mutation_cases_parcel_id_land_parcels_id_fk" FOREIGN KEY ("parcel_id") REFERENCES "public"."land_parcels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "power_of_attorney" ADD CONSTRAINT "power_of_attorney_parcel_id_land_parcels_id_fk" FOREIGN KEY ("parcel_id") REFERENCES "public"."land_parcels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "power_of_attorney" ADD CONSTRAINT "power_of_attorney_grantor_owner_id_owners_id_fk" FOREIGN KEY ("grantor_owner_id") REFERENCES "public"."owners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "power_of_attorney" ADD CONSTRAINT "power_of_attorney_attorney_holder_owner_id_owners_id_fk" FOREIGN KEY ("attorney_holder_owner_id") REFERENCES "public"."owners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "land_use" ADD CONSTRAINT "land_use_parcel_id_land_parcels_id_fk" FOREIGN KEY ("parcel_id") REFERENCES "public"."land_parcels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "land_acquisition" ADD CONSTRAINT "land_acquisition_parcel_id_land_parcels_id_fk" FOREIGN KEY ("parcel_id") REFERENCES "public"."land_parcels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "land_transactions" ADD CONSTRAINT "land_transactions_parcel_id_land_parcels_id_fk" FOREIGN KEY ("parcel_id") REFERENCES "public"."land_parcels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "land_transactions" ADD CONSTRAINT "land_transactions_seller_owner_id_owners_id_fk" FOREIGN KEY ("seller_owner_id") REFERENCES "public"."owners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "land_transactions" ADD CONSTRAINT "land_transactions_buyer_owner_id_owners_id_fk" FOREIGN KEY ("buyer_owner_id") REFERENCES "public"."owners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mortgages" ADD CONSTRAINT "mortgages_parcel_id_land_parcels_id_fk" FOREIGN KEY ("parcel_id") REFERENCES "public"."land_parcels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_jobs" ADD CONSTRAINT "report_jobs_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;