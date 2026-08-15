CREATE TYPE "public"."audit_entity_type" AS ENUM('user', 'pilot_profile', 'drone', 'remote_id', 'zone', 'zone_closure', 'booking', 'city');--> statement-breakpoint
CREATE TYPE "public"."booking_status" AS ENUM('pending', 'approved', 'rejected', 'cancelled', 'completed', 'no_show');--> statement-breakpoint
CREATE TYPE "public"."drone_build_type" AS ENUM('commercial', 'self_built', 'fpv');--> statement-breakpoint
CREATE TYPE "public"."drone_photo_kind" AS ENUM('overall', 'serial_plate', 'remote_id_module', 'payload');--> statement-breakpoint
CREATE TYPE "public"."drone_status" AS ENUM('draft', 'pending', 'approved', 'rejected', 'expired', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."drone_weight_class" AS ENUM('micro', 'light', 'medium', 'heavy');--> statement-breakpoint
CREATE TYPE "public"."id_document_type" AS ENUM('saudi_national_id', 'iqama', 'gcc_id');--> statement-breakpoint
CREATE TYPE "public"."notification_category" AS ENUM('booking_reminder', 'registration_expiry', 'zone_closure');--> statement-breakpoint
CREATE TYPE "public"."notification_status" AS ENUM('unread', 'read', 'archived');--> statement-breakpoint
CREATE TYPE "public"."remote_id_decl_kind" AS ENUM('faa_broadcast_module', 'gaca_dri', 'gaca_nri', 'other');--> statement-breakpoint
CREATE TYPE "public"."remote_id_status" AS ENUM('active', 'suspended', 'retired');--> statement-breakpoint
CREATE TYPE "public"."zone_kind" AS ENUM('permitted', 'restricted', 'no_fly');--> statement-breakpoint
CREATE TYPE "public"."zone_status" AS ENUM('draft', 'active', 'suspended', 'archived');--> statement-breakpoint
CREATE TABLE "audit_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" text,
	"actor_role" text,
	"actor_is_system" boolean DEFAULT false NOT NULL,
	"entity_type" "audit_entity_type" NOT NULL,
	"entity_id" text NOT NULL,
	"action" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"reason" text,
	"ip_hash" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pilot_user_id" text NOT NULL,
	"drone_id" uuid NOT NULL,
	"remote_id_id" uuid NOT NULL,
	"zone_id" uuid NOT NULL,
	"slot_start" timestamp with time zone NOT NULL,
	"slot_end" timestamp with time zone NOT NULL,
	"seat_index" smallint NOT NULL,
	"status" "booking_status" DEFAULT 'pending' NOT NULL,
	"purpose" text,
	"purpose_note" text,
	"planned_altitude_m" integer,
	"decided_at" timestamp with time zone,
	"decided_by_user_id" text,
	"rejection_reason" text,
	"cancelled_at" timestamp with time zone,
	"cancelled_by_user_id" text,
	"cancellation_reason" text,
	"checked_in_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"decision_snapshot" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking_copilot" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"full_name_ar" text NOT NULL,
	"full_name_en" text NOT NULL,
	"mobile_e164" text,
	"id_document_number" text,
	"user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "city" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name_ar" text NOT NULL,
	"name_en" text NOT NULL,
	"centroid_lat" double precision NOT NULL,
	"centroid_lng" double precision NOT NULL,
	"is_modelled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "city_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "drone" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" text NOT NULL,
	"nickname" text NOT NULL,
	"manufacturer" text,
	"model" text,
	"serial_number" text,
	"build_type" "drone_build_type" NOT NULL,
	"weight_grams" integer NOT NULL,
	"weight_class" "drone_weight_class" NOT NULL,
	"propulsion" text,
	"has_camera" boolean DEFAULT false NOT NULL,
	"status" "drone_status" DEFAULT 'draft' NOT NULL,
	"submitted_at" timestamp with time zone,
	"decided_at" timestamp with time zone,
	"decided_by_user_id" text,
	"rejection_reason" text,
	"rejection_count" integer DEFAULT 0 NOT NULL,
	"registration_issued_at" timestamp with time zone,
	"registration_expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"revocation_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drone_photo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"drone_id" uuid NOT NULL,
	"url" text NOT NULL,
	"pathname" text NOT NULL,
	"kind" "drone_photo_kind" DEFAULT 'overall' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"to_address" text NOT NULL,
	"subject" text NOT NULL,
	"template" text NOT NULL,
	"locale" text NOT NULL,
	"entity_id" text,
	"provider_message_id" text,
	"status" text DEFAULT 'queued' NOT NULL,
	"error" text,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"params" jsonb,
	"entity_type" "audit_entity_type",
	"entity_id" text,
	"href" text,
	"status" "notification_status" DEFAULT 'unread' NOT NULL,
	"read_at" timestamp with time zone,
	"email_log_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_preference" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"category" "notification_category" NOT NULL,
	"email_enabled" boolean DEFAULT true NOT NULL,
	"in_app_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pilot_profile" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"full_name_ar" text NOT NULL,
	"full_name_en" text NOT NULL,
	"id_document_type" "id_document_type" NOT NULL,
	"id_document_number" text NOT NULL,
	"id_document_hash" text NOT NULL,
	"date_of_birth" date,
	"mobile_e164" text,
	"address_city_id" uuid,
	"address_line" text,
	"emergency_contact" text,
	"completed_at" timestamp with time zone,
	"verified_at" timestamp with time zone,
	"verified_by_user_id" text,
	"rejected_at" timestamp with time zone,
	"rejection_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pilot_profile_userId_unique" UNIQUE("user_id"),
	CONSTRAINT "pilot_profile_idDocumentHash_unique" UNIQUE("id_document_hash")
);
--> statement-breakpoint
CREATE TABLE "remote_id" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"drone_id" uuid NOT NULL,
	"code" text NOT NULL,
	"status" "remote_id_status" DEFAULT 'active' NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"network_capable" boolean DEFAULT false NOT NULL,
	"broadcast_capable" boolean DEFAULT false NOT NULL,
	"qr_pathname" text,
	"last_resolved_at" timestamp with time zone,
	"resolve_count" integer DEFAULT 0 NOT NULL,
	"suspended_at" timestamp with time zone,
	"suspension_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "remote_id_droneId_unique" UNIQUE("drone_id"),
	CONSTRAINT "remote_id_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "remote_id_declaration" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"remote_id_id" uuid NOT NULL,
	"kind" "remote_id_decl_kind" NOT NULL,
	"manufacturer" text,
	"module_serial" text,
	"doc_reference" text,
	"doc_path" text,
	"valid_from" timestamp with time zone,
	"valid_until" timestamp with time zone,
	"verified_at" timestamp with time zone,
	"verified_by_user_id" text,
	"rejected_at" timestamp with time zone,
	"rejection_reason" text,
	"superseded_at" timestamp with time zone,
	"notes_ar" text,
	"notes_en" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zone" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"city_id" uuid NOT NULL,
	"code" text NOT NULL,
	"kind" "zone_kind" NOT NULL,
	"status" "zone_status" DEFAULT 'draft' NOT NULL,
	"name_ar" text NOT NULL,
	"name_en" text NOT NULL,
	"district_ar" text,
	"district_en" text,
	"notes_ar" text,
	"notes_en" text,
	"geometry" jsonb NOT NULL,
	"geometry_version" integer DEFAULT 1 NOT NULL,
	"vertex_count" integer DEFAULT 0 NOT NULL,
	"min_lat" double precision NOT NULL,
	"max_lat" double precision NOT NULL,
	"min_lng" double precision NOT NULL,
	"max_lng" double precision NOT NULL,
	"ceiling_agl_m" integer,
	"floor_agl_m" integer DEFAULT 0 NOT NULL,
	"capacity" integer DEFAULT 1 NOT NULL,
	"slot_duration_minutes" integer DEFAULT 60 NOT NULL,
	"min_lead_minutes" integer DEFAULT 60 NOT NULL,
	"max_advance_days" integer DEFAULT 30 NOT NULL,
	"max_slots_per_pilot_per_day" integer DEFAULT 2 NOT NULL,
	"auto_approve" boolean DEFAULT false NOT NULL,
	"night_allowed" boolean DEFAULT false NOT NULL,
	"max_weight_class" "drone_weight_class",
	"permitted_build_types" "drone_build_type"[],
	"requires_broadcast_rid" boolean DEFAULT false NOT NULL,
	"authority_ref" text,
	"published_at" timestamp with time zone,
	"created_by_user_id" text,
	"updated_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "zone_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "zone_closure" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"zone_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"reason_ar" text NOT NULL,
	"reason_en" text NOT NULL,
	"authority_ref" text,
	"published_at" timestamp with time zone,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zone_hour" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"zone_id" uuid NOT NULL,
	"weekday" smallint NOT NULL,
	"opens_minute" integer NOT NULL,
	"closes_minute" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_drone_id_drone_id_fk" FOREIGN KEY ("drone_id") REFERENCES "public"."drone"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_remote_id_id_remote_id_id_fk" FOREIGN KEY ("remote_id_id") REFERENCES "public"."remote_id"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_zone_id_zone_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."zone"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_copilot" ADD CONSTRAINT "booking_copilot_booking_id_booking_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."booking"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drone_photo" ADD CONSTRAINT "drone_photo_drone_id_drone_id_fk" FOREIGN KEY ("drone_id") REFERENCES "public"."drone"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pilot_profile" ADD CONSTRAINT "pilot_profile_address_city_id_city_id_fk" FOREIGN KEY ("address_city_id") REFERENCES "public"."city"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "remote_id" ADD CONSTRAINT "remote_id_drone_id_drone_id_fk" FOREIGN KEY ("drone_id") REFERENCES "public"."drone"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "remote_id_declaration" ADD CONSTRAINT "remote_id_declaration_remote_id_id_remote_id_id_fk" FOREIGN KEY ("remote_id_id") REFERENCES "public"."remote_id"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zone" ADD CONSTRAINT "zone_city_id_city_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."city"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zone_closure" ADD CONSTRAINT "zone_closure_zone_id_zone_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."zone"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zone_hour" ADD CONSTRAINT "zone_hour_zone_id_zone_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."zone"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_entity_idx" ON "audit_event" USING btree ("entity_type","entity_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_actor_idx" ON "audit_event" USING btree ("actor_user_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_action_idx" ON "audit_event" USING btree ("action","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "booking_seat_uniq" ON "booking" USING btree ("zone_id","slot_start","seat_index") WHERE status in ('pending','approved');--> statement-breakpoint
CREATE UNIQUE INDEX "booking_drone_slot_uniq" ON "booking" USING btree ("drone_id","slot_start") WHERE status in ('pending','approved');--> statement-breakpoint
CREATE UNIQUE INDEX "booking_pilot_slot_uniq" ON "booking" USING btree ("pilot_user_id","slot_start") WHERE status in ('pending','approved');--> statement-breakpoint
CREATE INDEX "booking_pilot_idx" ON "booking" USING btree ("pilot_user_id","slot_start");--> statement-breakpoint
CREATE INDEX "booking_zone_slot_idx" ON "booking" USING btree ("zone_id","slot_start");--> statement-breakpoint
CREATE INDEX "booking_queue_idx" ON "booking" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "booking_copilot_booking_idx" ON "booking_copilot" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "drone_owner_status_idx" ON "drone" USING btree ("owner_user_id","status");--> statement-breakpoint
CREATE INDEX "drone_status_submitted_idx" ON "drone" USING btree ("status","submitted_at");--> statement-breakpoint
CREATE INDEX "drone_expires_idx" ON "drone" USING btree ("registration_expires_at");--> statement-breakpoint
CREATE INDEX "drone_photo_drone_idx" ON "drone_photo" USING btree ("drone_id","sort_order");--> statement-breakpoint
CREATE INDEX "email_log_user_idx" ON "email_log" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "email_log_status_idx" ON "email_log" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "notification_user_idx" ON "notification" USING btree ("user_id","status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_pref_uniq" ON "notification_preference" USING btree ("user_id","category");--> statement-breakpoint
CREATE INDEX "pilot_profile_verification_idx" ON "pilot_profile" USING btree ("verified_at","created_at");--> statement-breakpoint
CREATE INDEX "remote_id_status_idx" ON "remote_id" USING btree ("status");--> statement-breakpoint
CREATE INDEX "remote_id_decl_remote_idx" ON "remote_id_declaration" USING btree ("remote_id_id");--> statement-breakpoint
CREATE UNIQUE INDEX "remote_id_decl_active_module_uniq" ON "remote_id_declaration" USING btree ("kind","module_serial") WHERE superseded_at is null and module_serial is not null;--> statement-breakpoint
CREATE INDEX "zone_city_status_idx" ON "zone" USING btree ("city_id","status");--> statement-breakpoint
CREATE INDEX "zone_kind_idx" ON "zone" USING btree ("kind","status");--> statement-breakpoint
CREATE INDEX "zone_bbox_idx" ON "zone" USING btree ("min_lat","max_lat","min_lng","max_lng");--> statement-breakpoint
CREATE INDEX "zone_closure_window_idx" ON "zone_closure" USING btree ("zone_id","starts_at","ends_at");--> statement-breakpoint
CREATE UNIQUE INDEX "zone_hour_uniq" ON "zone_hour" USING btree ("zone_id","weekday","opens_minute");--> statement-breakpoint
CREATE INDEX "zone_hour_zone_idx" ON "zone_hour" USING btree ("zone_id","weekday");