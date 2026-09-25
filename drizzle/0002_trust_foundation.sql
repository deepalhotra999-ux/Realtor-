CREATE TYPE "public"."actor_type" AS ENUM('system', 'admin', 'user');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('queued', 'running', 'succeeded', 'dead');--> statement-breakpoint
CREATE TYPE "public"."listing_verification" AS ENUM('unverified', 'pending_verification', 'verified', 'flagged', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."moderation_case_status" AS ENUM('clear', 'flagged', 'pending_review', 'approved', 'rejected', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."priority_level" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."promotion_status" AS ENUM('pending_payment', 'scheduled', 'active', 'expired', 'canceled');--> statement-breakpoint
CREATE TYPE "public"."risk_level" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."verification_kind" AS ENUM('email', 'phone', 'identity', 'ownership', 'license', 'brokerage');--> statement-breakpoint
CREATE TYPE "public"."verification_status" AS ENUM('pending', 'approved', 'rejected', 'expired', 'cancelled');--> statement-breakpoint
ALTER TYPE "public"."listing_status" ADD VALUE 'pending_review';--> statement-breakpoint
ALTER TYPE "public"."listing_status" ADD VALUE 'expired';--> statement-breakpoint
ALTER TYPE "public"."listing_status" ADD VALUE 'suspended';--> statement-breakpoint
ALTER TYPE "public"."listing_status" ADD VALUE 'removed';--> statement-breakpoint
ALTER TYPE "public"."user_role" ADD VALUE 'developer';--> statement-breakpoint
ALTER TYPE "public"."user_status" ADD VALUE 'warned';--> statement-breakpoint
ALTER TYPE "public"."user_status" ADD VALUE 'restricted';--> statement-breakpoint
ALTER TYPE "public"."user_status" ADD VALUE 'banned';--> statement-breakpoint
ALTER TYPE "public"."user_status" ADD VALUE 'deleted';--> statement-breakpoint
CREATE TABLE "account_restrictions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"feature" text NOT NULL,
	"reason" text NOT NULL,
	"starts_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ends_at" timestamp with time zone,
	"created_by_id" uuid,
	"source" text,
	"lifted_at" timestamp with time zone,
	"lifted_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "account_signals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"kind" text NOT NULL,
	"ip" text,
	"ip_prefix" text,
	"device_hash" text,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_schedules" (
	"name" text PRIMARY KEY NOT NULL,
	"job_type" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"interval_seconds" integer NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"last_run_at" timestamp with time zone,
	"next_run_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "job_status" DEFAULT 'queued' NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"run_at" timestamp with time zone DEFAULT now() NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 5 NOT NULL,
	"dedupe_key" text,
	"locked_at" timestamp with time zone,
	"locked_by" text,
	"last_error" text,
	"result" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "listing_promotions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"user_id" uuid,
	"status" "promotion_status" DEFAULT 'scheduled' NOT NULL,
	"placement" text NOT NULL,
	"priority" integer NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"amount" integer DEFAULT 0 NOT NULL,
	"payment_id" uuid,
	"impressions" integer DEFAULT 0 NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	"saves" integer DEFAULT 0 NOT NULL,
	"leads" integer DEFAULT 0 NOT NULL,
	"granted_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "moderation_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"subject_user_id" uuid,
	"status" "moderation_case_status" DEFAULT 'pending_review' NOT NULL,
	"priority" "priority_level" DEFAULT 'medium' NOT NULL,
	"reason" text NOT NULL,
	"confidence" real DEFAULT 0 NOT NULL,
	"source" text NOT NULL,
	"signals" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"auto_action" text,
	"reviewed_by_id" uuid,
	"reviewed_at" timestamp with time zone,
	"resolution" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "promotion_products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"placement" text NOT NULL,
	"price" integer DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"duration_days" integer DEFAULT 7 NOT NULL,
	"priority" integer DEFAULT 10 NOT NULL,
	"eligibility" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"max_inventory" integer,
	"available_from" timestamp with time zone,
	"available_until" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "risk_assessments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" text NOT NULL,
	"score" integer NOT NULL,
	"level" "risk_level" NOT NULL,
	"signals" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "strikes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"violation_type" text NOT NULL,
	"reason" text NOT NULL,
	"source_ref" text,
	"created_by_id" uuid,
	"source" text,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" "verification_kind" NOT NULL,
	"status" "verification_status" DEFAULT 'pending' NOT NULL,
	"provider" text NOT NULL,
	"provider_ref" text,
	"subject" text,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"document_keys" text[] DEFAULT '{}'::text[] NOT NULL,
	"code_hash" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"reviewer_id" uuid,
	"reviewed_at" timestamp with time zone,
	"decision_reason" text,
	"expires_at" timestamp with time zone,
	"purge_after" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN "actor_type" "actor_type" DEFAULT 'admin' NOT NULL;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN "actor_label" text;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN "reason" text;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN "before" jsonb;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN "after" jsonb;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN "ip" text;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN "user_agent" text;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "verification_status" "listing_verification" DEFAULT 'unverified' NOT NULL;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "risk_score" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "content_hash" text;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "rank_adjustment" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "pinned_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "property_media" ADD COLUMN "content_hash" text;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "priority" "priority_level" DEFAULT 'medium' NOT NULL;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "priority_reason" text;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "subject_user_id" uuid;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "phone_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "verification_level" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "capabilities" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "risk_score" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "risk_level" "risk_level" DEFAULT 'low' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "risk_updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "status_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "status_reason" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "signup_ip" text;--> statement-breakpoint
ALTER TABLE "account_restrictions" ADD CONSTRAINT "account_restrictions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_restrictions" ADD CONSTRAINT "account_restrictions_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_restrictions" ADD CONSTRAINT "account_restrictions_lifted_by_id_users_id_fk" FOREIGN KEY ("lifted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_signals" ADD CONSTRAINT "account_signals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_promotions" ADD CONSTRAINT "listing_promotions_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_promotions" ADD CONSTRAINT "listing_promotions_product_id_promotion_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."promotion_products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_promotions" ADD CONSTRAINT "listing_promotions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_promotions" ADD CONSTRAINT "listing_promotions_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_promotions" ADD CONSTRAINT "listing_promotions_granted_by_id_users_id_fk" FOREIGN KEY ("granted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_cases" ADD CONSTRAINT "moderation_cases_subject_user_id_users_id_fk" FOREIGN KEY ("subject_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_cases" ADD CONSTRAINT "moderation_cases_reviewed_by_id_users_id_fk" FOREIGN KEY ("reviewed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strikes" ADD CONSTRAINT "strikes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strikes" ADD CONSTRAINT "strikes_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verifications" ADD CONSTRAINT "verifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verifications" ADD CONSTRAINT "verifications_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_restrictions_user_idx" ON "account_restrictions" USING btree ("user_id","feature");--> statement-breakpoint
CREATE INDEX "account_restrictions_ends_idx" ON "account_restrictions" USING btree ("ends_at");--> statement-breakpoint
CREATE INDEX "account_signals_user_idx" ON "account_signals" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "account_signals_ip_idx" ON "account_signals" USING btree ("ip_prefix");--> statement-breakpoint
CREATE INDEX "account_signals_device_idx" ON "account_signals" USING btree ("device_hash");--> statement-breakpoint
CREATE INDEX "jobs_claim_idx" ON "jobs" USING btree ("status","run_at","priority");--> statement-breakpoint
CREATE UNIQUE INDEX "jobs_dedupe_uq" ON "jobs" USING btree ("dedupe_key") WHERE status in ('queued', 'running') and dedupe_key is not null;--> statement-breakpoint
CREATE INDEX "listing_promotions_listing_idx" ON "listing_promotions" USING btree ("listing_id","status");--> statement-breakpoint
CREATE INDEX "listing_promotions_status_idx" ON "listing_promotions" USING btree ("status","ends_at");--> statement-breakpoint
CREATE INDEX "listing_promotions_start_idx" ON "listing_promotions" USING btree ("status","starts_at");--> statement-breakpoint
CREATE INDEX "moderation_cases_status_idx" ON "moderation_cases" USING btree ("status","priority");--> statement-breakpoint
CREATE INDEX "moderation_cases_target_idx" ON "moderation_cases" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "moderation_cases_subject_idx" ON "moderation_cases" USING btree ("subject_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "promotion_products_key_uq" ON "promotion_products" USING btree ("key");--> statement-breakpoint
CREATE INDEX "risk_assessments_subject_idx" ON "risk_assessments" USING btree ("subject_type","subject_id","created_at");--> statement-breakpoint
CREATE INDEX "strikes_user_idx" ON "strikes" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "verifications_user_idx" ON "verifications" USING btree ("user_id","kind");--> statement-breakpoint
CREATE INDEX "verifications_status_idx" ON "verifications" USING btree ("status");--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_subject_user_id_users_id_fk" FOREIGN KEY ("subject_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_target_idx" ON "audit_logs" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "audit_logs_actor_idx" ON "audit_logs" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "listings_expires_idx" ON "listings" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "listings_content_hash_idx" ON "listings" USING btree ("content_hash");--> statement-breakpoint
CREATE INDEX "property_media_hash_idx" ON "property_media" USING btree ("content_hash");--> statement-breakpoint
CREATE INDEX "reports_target_idx" ON "reports" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "reports_subject_idx" ON "reports" USING btree ("subject_user_id");