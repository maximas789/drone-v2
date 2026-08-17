CREATE TYPE "public"."remote_id_viewer_level" AS ENUM('anonymous', 'pilot', 'owner', 'reviewer', 'admin');--> statement-breakpoint
CREATE TABLE "drone_report" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"remote_id_id" uuid,
	"reported_code" text NOT NULL,
	"description" text NOT NULL,
	"location_lat" double precision,
	"location_lng" double precision,
	"location_note" text,
	"reporter_user_id" text,
	"ip_hash" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "remote_id_scan" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"remote_id_id" uuid,
	"scanned_code" text NOT NULL,
	"viewer_user_id" text,
	"viewer_level" "remote_id_viewer_level" NOT NULL,
	"ip_hash" text,
	"user_agent" text,
	"revealed_identity" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "drone_report" ADD CONSTRAINT "drone_report_remote_id_id_remote_id_id_fk" FOREIGN KEY ("remote_id_id") REFERENCES "public"."remote_id"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drone_report" ADD CONSTRAINT "drone_report_reporter_user_id_user_id_fk" FOREIGN KEY ("reporter_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "remote_id_scan" ADD CONSTRAINT "remote_id_scan_remote_id_id_remote_id_id_fk" FOREIGN KEY ("remote_id_id") REFERENCES "public"."remote_id"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "remote_id_scan" ADD CONSTRAINT "remote_id_scan_viewer_user_id_user_id_fk" FOREIGN KEY ("viewer_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "drone_report_remote_idx" ON "drone_report" USING btree ("remote_id_id","created_at");--> statement-breakpoint
CREATE INDEX "drone_report_created_idx" ON "drone_report" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "remote_id_scan_remote_idx" ON "remote_id_scan" USING btree ("remote_id_id","created_at");--> statement-breakpoint
CREATE INDEX "remote_id_scan_viewer_idx" ON "remote_id_scan" USING btree ("viewer_user_id","created_at");--> statement-breakpoint
CREATE INDEX "remote_id_scan_revealed_idx" ON "remote_id_scan" USING btree ("revealed_identity","created_at");