CREATE TABLE "rate_limit_bucket" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limit" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"count" integer NOT NULL,
	"last_request" bigint NOT NULL,
	CONSTRAINT "rate_limit_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "rate_limit_bucket_uniq" ON "rate_limit_bucket" USING btree ("key","window_start");--> statement-breakpoint
CREATE INDEX "rate_limit_bucket_expiry_idx" ON "rate_limit_bucket" USING btree ("expires_at");