CREATE TABLE "learning_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"membership_id" uuid NOT NULL,
	"lesson_key" text NOT NULL,
	"state" text DEFAULT 'IN_PROGRESS' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learning_audit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cohort_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"action" text NOT NULL,
	"subject_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learning_charges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cohort_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"reservation_id" uuid NOT NULL,
	"state" text DEFAULT 'RESERVED' NOT NULL,
	"amount_usd" numeric(12, 6) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "learning_charges_reservation_id_unique" UNIQUE("reservation_id")
);
--> statement-breakpoint
CREATE TABLE "learning_cohorts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"title" text NOT NULL,
	"state" text DEFAULT 'DRAFT' NOT NULL,
	"capacity" integer DEFAULT 20 NOT NULL,
	"budget_usd" numeric(12, 6) NOT NULL,
	"student_budget_usd" numeric(12, 6) NOT NULL,
	"curriculum_version" text DEFAULT 'ffe-1' NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learning_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cohort_id" uuid NOT NULL,
	"email" text NOT NULL,
	"role" text DEFAULT 'STUDENT' NOT NULL,
	"token_hash" text NOT NULL,
	"state" text DEFAULT 'ISSUED' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "learning_invitations_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "learning_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cohort_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text DEFAULT 'STUDENT' NOT NULL,
	"state" text DEFAULT 'ACTIVE' NOT NULL,
	"track" text DEFAULT 'BOTH' NOT NULL,
	"terms_version" text DEFAULT 'ffe-free-1' NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learning_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" uuid NOT NULL,
	"reviewer_id" uuid NOT NULL,
	"decision" text NOT NULL,
	"feedback" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learning_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assignment_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"mode" text NOT NULL,
	"text" text NOT NULL,
	"artifact_ids" jsonb NOT NULL,
	"source_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "learning_assignments" ADD CONSTRAINT "learning_assignments_membership_id_learning_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."learning_memberships"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_audit" ADD CONSTRAINT "learning_audit_cohort_id_learning_cohorts_id_fk" FOREIGN KEY ("cohort_id") REFERENCES "public"."learning_cohorts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_audit" ADD CONSTRAINT "learning_audit_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_charges" ADD CONSTRAINT "learning_charges_cohort_id_learning_cohorts_id_fk" FOREIGN KEY ("cohort_id") REFERENCES "public"."learning_cohorts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_charges" ADD CONSTRAINT "learning_charges_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_cohorts" ADD CONSTRAINT "learning_cohorts_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_invitations" ADD CONSTRAINT "learning_invitations_cohort_id_learning_cohorts_id_fk" FOREIGN KEY ("cohort_id") REFERENCES "public"."learning_cohorts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_invitations" ADD CONSTRAINT "learning_invitations_accepted_user_id_users_id_fk" FOREIGN KEY ("accepted_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_memberships" ADD CONSTRAINT "learning_memberships_cohort_id_learning_cohorts_id_fk" FOREIGN KEY ("cohort_id") REFERENCES "public"."learning_cohorts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_memberships" ADD CONSTRAINT "learning_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_reviews" ADD CONSTRAINT "learning_reviews_submission_id_learning_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."learning_submissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_reviews" ADD CONSTRAINT "learning_reviews_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_submissions" ADD CONSTRAINT "learning_submissions_assignment_id_learning_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."learning_assignments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "learning_assignment_unique" ON "learning_assignments" USING btree ("membership_id","lesson_key");--> statement-breakpoint
CREATE INDEX "learning_charges_scope" ON "learning_charges" USING btree ("cohort_id","user_id","state");--> statement-breakpoint
CREATE UNIQUE INDEX "learning_membership_unique" ON "learning_memberships" USING btree ("cohort_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "learning_review_once" ON "learning_reviews" USING btree ("submission_id");--> statement-breakpoint
CREATE UNIQUE INDEX "learning_submission_version_unique" ON "learning_submissions" USING btree ("assignment_id","version");