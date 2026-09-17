CREATE TYPE "public"."notification_trigger" AS ENUM('brief_assigned', 'internal_revisions_requested', 'ad_submitted', 'client_approved', 'client_requested_revisions', 'creative_ready_to_launch', 'creator_status_changed', 'partnership_expiring');--> statement-breakpoint
CREATE TABLE "notification_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_by" text,
	"deleted_at" timestamp with time zone,
	"trigger_key" text NOT NULL,
	"slack_enabled" boolean DEFAULT true NOT NULL,
	"email_enabled" boolean DEFAULT false NOT NULL,
	"position" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notification_settings" ADD CONSTRAINT "notification_settings_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notification_settings_brand_id_idx" ON "notification_settings" USING btree ("brand_id");--> statement-breakpoint
CREATE INDEX "notification_settings_brand_position_idx" ON "notification_settings" USING btree ("brand_id","position");