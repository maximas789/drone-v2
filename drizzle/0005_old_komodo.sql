CREATE TYPE "public"."drone_report_status" AS ENUM('open', 'actioned', 'dismissed');--> statement-breakpoint
ALTER TYPE "public"."audit_entity_type" ADD VALUE 'drone_report';--> statement-breakpoint
CREATE TABLE "review_presence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" "audit_entity_type" NOT NULL,
	"entity_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "drone_report" ADD COLUMN "status" "drone_report_status" DEFAULT 'open' NOT NULL;--> statement-breakpoint
ALTER TABLE "drone_report" ADD COLUMN "handled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "drone_report" ADD COLUMN "handled_by_user_id" text;--> statement-breakpoint
ALTER TABLE "drone_report" ADD COLUMN "handling_note" text;--> statement-breakpoint
ALTER TABLE "drone_report" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "review_presence" ADD CONSTRAINT "review_presence_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "review_presence_uniq" ON "review_presence" USING btree ("entity_type","entity_id","user_id");--> statement-breakpoint
CREATE INDEX "review_presence_expiry_idx" ON "review_presence" USING btree ("expires_at");--> statement-breakpoint
ALTER TABLE "drone_report" ADD CONSTRAINT "drone_report_handled_by_user_id_user_id_fk" FOREIGN KEY ("handled_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "drone_report_status_idx" ON "drone_report" USING btree ("status","created_at");