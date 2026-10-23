CREATE TABLE "learning_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"membership_id" uuid NOT NULL,
	"state" text DEFAULT 'PENDING' NOT NULL,
	"provider_id" text,
	"error" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learning_followups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cohort_id" uuid NOT NULL,
	"membership_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"lesson_key" text,
	"title" text NOT NULL,
	"feedback" text NOT NULL,
	"action_plan" text NOT NULL,
	"state" text DEFAULT 'OPEN' NOT NULL,
	"due_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learning_meetings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cohort_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"title" text NOT NULL,
	"agenda" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"meeting_url" text,
	"membership_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"state" text DEFAULT 'SCHEDULED' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learning_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cohort_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"request_id" uuid NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learning_resources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cohort_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"source_id" text NOT NULL,
	"title" text NOT NULL,
	"kind" text NOT NULL,
	"body" text NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"lesson_key" text,
	"state" text DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "learning_deliveries" ADD CONSTRAINT "learning_deliveries_message_id_learning_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."learning_messages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_deliveries" ADD CONSTRAINT "learning_deliveries_membership_id_learning_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."learning_memberships"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_followups" ADD CONSTRAINT "learning_followups_cohort_id_learning_cohorts_id_fk" FOREIGN KEY ("cohort_id") REFERENCES "public"."learning_cohorts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_followups" ADD CONSTRAINT "learning_followups_membership_id_learning_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."learning_memberships"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_followups" ADD CONSTRAINT "learning_followups_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_meetings" ADD CONSTRAINT "learning_meetings_cohort_id_learning_cohorts_id_fk" FOREIGN KEY ("cohort_id") REFERENCES "public"."learning_cohorts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_meetings" ADD CONSTRAINT "learning_meetings_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_messages" ADD CONSTRAINT "learning_messages_cohort_id_learning_cohorts_id_fk" FOREIGN KEY ("cohort_id") REFERENCES "public"."learning_cohorts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_messages" ADD CONSTRAINT "learning_messages_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_resources" ADD CONSTRAINT "learning_resources_cohort_id_learning_cohorts_id_fk" FOREIGN KEY ("cohort_id") REFERENCES "public"."learning_cohorts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_resources" ADD CONSTRAINT "learning_resources_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "learning_deliveries_recipient" ON "learning_deliveries" USING btree ("message_id","membership_id");--> statement-breakpoint
CREATE INDEX "learning_followups_scope" ON "learning_followups" USING btree ("cohort_id","membership_id");--> statement-breakpoint
CREATE INDEX "learning_meetings_scope" ON "learning_meetings" USING btree ("cohort_id","starts_at");--> statement-breakpoint
CREATE UNIQUE INDEX "learning_messages_request" ON "learning_messages" USING btree ("cohort_id","request_id");--> statement-breakpoint
CREATE INDEX "learning_resources_scope" ON "learning_resources" USING btree ("cohort_id","state");