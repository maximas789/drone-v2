CREATE TYPE "public"."job_status" AS ENUM('running', 'completed', 'failed', 'cancelling', 'cancelled');--> statement-breakpoint
CREATE TABLE "job" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" text NOT NULL,
	"function_id" text NOT NULL,
	"status" "job_status" DEFAULT 'running' NOT NULL,
	"attempt" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"duration_ms" integer,
	"error" text,
	"output" jsonb,
	"trigger_event" text,
	"rerun_of_run_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "job_runId_unique" UNIQUE("run_id")
);
--> statement-breakpoint
CREATE INDEX "job_function_started_idx" ON "job" USING btree ("function_id","started_at");--> statement-breakpoint
CREATE INDEX "job_status_started_idx" ON "job" USING btree ("status","started_at");