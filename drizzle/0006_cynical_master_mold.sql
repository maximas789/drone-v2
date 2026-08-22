ALTER TABLE "drone" DROP CONSTRAINT "drone_owner_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "drone" ALTER COLUMN "owner_user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "drone" ADD CONSTRAINT "drone_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;