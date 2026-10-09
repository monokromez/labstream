CREATE TYPE "public"."payment_method" AS ENUM('cash', 'card', 'other');--> statement-breakpoint
CREATE TYPE "public"."queue_status" AS ENUM('waiting', 'called', 'serving', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."request_status" AS ENUM('queued', 'paid', 'specimen_received', 'processing', 'for_validation', 'released', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."result_type" AS ENUM('numeric', 'text');--> statement-breakpoint
CREATE TYPE "public"."review_decision" AS ENUM('approved', 'returned');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" uuid,
	"action" varchar(100) NOT NULL,
	"entity_type" varchar(100) NOT NULL,
	"entity_id" uuid,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "patients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"pid" varchar(32) NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"date_of_birth" date,
	"sex" varchar(32),
	"phone" varchar(32),
	"address" text,
	"registered_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "patients_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "patients_pid_unique" UNIQUE("pid")
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"method" "payment_method" NOT NULL,
	"receipt_number" varchar(64) NOT NULL,
	"recorded_by" uuid NOT NULL,
	"paid_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_receipt_number_unique" UNIQUE("receipt_number"),
	CONSTRAINT "payments_amount_positive" CHECK ("payments"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "queue_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"queue_date" date DEFAULT CURRENT_DATE NOT NULL,
	"queue_number" integer NOT NULL,
	"status" "queue_status" DEFAULT 'waiting' NOT NULL,
	"called_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"called_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "queue_entries_request_id_unique" UNIQUE("request_id"),
	CONSTRAINT "queue_entries_date_number_unique" UNIQUE("queue_date","queue_number"),
	CONSTRAINT "queue_entries_number_positive" CHECK ("queue_entries"."queue_number" > 0)
);
--> statement-breakpoint
CREATE TABLE "reference_ranges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"test_id" uuid NOT NULL,
	"min_age_days" integer,
	"max_age_days" integer,
	"sex" varchar(32),
	"numeric_min" numeric(14, 4),
	"numeric_max" numeric(14, 4),
	"text_guidance" text,
	"unit" varchar(40),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reference_ranges_age_order" CHECK ("reference_ranges"."min_age_days" IS NULL OR "reference_ranges"."max_age_days" IS NULL OR "reference_ranges"."min_age_days" <= "reference_ranges"."max_age_days"),
	CONSTRAINT "reference_ranges_numeric_order" CHECK ("reference_ranges"."numeric_min" IS NULL OR "reference_ranges"."numeric_max" IS NULL OR "reference_ranges"."numeric_min" <= "reference_ranges"."numeric_max")
);
--> statement-breakpoint
CREATE TABLE "request_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"test_id" uuid NOT NULL,
	"test_name_snapshot" varchar(160) NOT NULL,
	"price_snapshot" numeric(10, 2) NOT NULL,
	"result_type_snapshot" "result_type" NOT NULL,
	"unit_snapshot" varchar(40),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "request_items_price_nonnegative" CHECK ("request_items"."price_snapshot" >= 0)
);
--> statement-breakpoint
CREATE TABLE "request_status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"old_status" "request_status",
	"new_status" "request_status" NOT NULL,
	"changed_by" uuid,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "result_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"reviewed_by" uuid NOT NULL,
	"decision" "review_decision" NOT NULL,
	"comments" text,
	"reviewed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_item_id" uuid NOT NULL,
	"numeric_value" numeric(14, 4),
	"text_value" text,
	"unit" varchar(40),
	"reference_min_snapshot" numeric(14, 4),
	"reference_max_snapshot" numeric(14, 4),
	"is_abnormal" boolean DEFAULT false NOT NULL,
	"remarks" text,
	"encoded_by" uuid NOT NULL,
	"encoded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "results_request_item_id_unique" UNIQUE("request_item_id"),
	CONSTRAINT "results_exactly_one_value" CHECK (num_nonnulls("results"."numeric_value", "results"."text_value") = 1),
	CONSTRAINT "results_reference_order" CHECK ("results"."reference_min_snapshot" IS NULL OR "results"."reference_max_snapshot" IS NULL OR "results"."reference_min_snapshot" <= "results"."reference_max_snapshot")
);
--> statement-breakpoint
CREATE TABLE "specimens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"specimen_type" varchar(100) NOT NULL,
	"received_by" uuid NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "test_catalog" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(40) NOT NULL,
	"name" varchar(160) NOT NULL,
	"description" text,
	"result_type" "result_type" NOT NULL,
	"unit" varchar(40),
	"price" numeric(10, 2) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "test_catalog_code_unique" UNIQUE("code"),
	CONSTRAINT "test_catalog_price_nonnegative" CHECK ("test_catalog"."price" >= 0)
);
--> statement-breakpoint
CREATE TABLE "test_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"created_by" uuid NOT NULL,
	"status" "request_status" DEFAULT 'queued' NOT NULL,
	"total_amount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"paid_at" timestamp with time zone,
	"released_at" timestamp with time zone,
	"released_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "test_requests_total_nonnegative" CHECK ("test_requests"."total_amount" >= 0)
);
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patients" ADD CONSTRAINT "patients_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patients" ADD CONSTRAINT "patients_registered_by_users_id_fk" FOREIGN KEY ("registered_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_request_id_test_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."test_requests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "queue_entries" ADD CONSTRAINT "queue_entries_request_id_test_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."test_requests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "queue_entries" ADD CONSTRAINT "queue_entries_called_by_users_id_fk" FOREIGN KEY ("called_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reference_ranges" ADD CONSTRAINT "reference_ranges_test_id_test_catalog_id_fk" FOREIGN KEY ("test_id") REFERENCES "public"."test_catalog"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_items" ADD CONSTRAINT "request_items_request_id_test_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."test_requests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_items" ADD CONSTRAINT "request_items_test_id_test_catalog_id_fk" FOREIGN KEY ("test_id") REFERENCES "public"."test_catalog"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_status_history" ADD CONSTRAINT "request_status_history_request_id_test_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."test_requests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_status_history" ADD CONSTRAINT "request_status_history_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "result_reviews" ADD CONSTRAINT "result_reviews_request_id_test_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."test_requests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "result_reviews" ADD CONSTRAINT "result_reviews_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "results" ADD CONSTRAINT "results_request_item_id_request_items_id_fk" FOREIGN KEY ("request_item_id") REFERENCES "public"."request_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "results" ADD CONSTRAINT "results_encoded_by_users_id_fk" FOREIGN KEY ("encoded_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "specimens" ADD CONSTRAINT "specimens_request_id_test_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."test_requests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "specimens" ADD CONSTRAINT "specimens_received_by_users_id_fk" FOREIGN KEY ("received_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_requests" ADD CONSTRAINT "test_requests_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_requests" ADD CONSTRAINT "test_requests_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_requests" ADD CONSTRAINT "test_requests_released_by_users_id_fk" FOREIGN KEY ("released_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_actor_time_idx" ON "audit_logs" USING btree ("actor_user_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "patients_name_idx" ON "patients" USING btree ("last_name","first_name");--> statement-breakpoint
CREATE INDEX "payments_request_idx" ON "payments" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "payments_paid_at_idx" ON "payments" USING btree ("paid_at");--> statement-breakpoint
CREATE INDEX "queue_entries_date_status_idx" ON "queue_entries" USING btree ("queue_date","status");--> statement-breakpoint
CREATE INDEX "reference_ranges_test_active_idx" ON "reference_ranges" USING btree ("test_id","is_active");--> statement-breakpoint
CREATE INDEX "request_items_request_idx" ON "request_items" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "request_status_history_request_time_idx" ON "request_status_history" USING btree ("request_id","changed_at");--> statement-breakpoint
CREATE INDEX "result_reviews_request_time_idx" ON "result_reviews" USING btree ("request_id","reviewed_at");--> statement-breakpoint
CREATE INDEX "specimens_request_idx" ON "specimens" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "test_requests_patient_created_idx" ON "test_requests" USING btree ("patient_id","created_at");--> statement-breakpoint
CREATE INDEX "test_requests_status_created_idx" ON "test_requests" USING btree ("status","created_at");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_staff_email_required" CHECK ("users"."role" = 'patient' OR "users"."email" IS NOT NULL);