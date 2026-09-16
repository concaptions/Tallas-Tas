ALTER TABLE "concepts" ADD COLUMN "formats" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "concepts" ADD COLUMN "ad_inspo_links" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "concepts" ADD COLUMN "internal_status" text DEFAULT 'sent_to_video_editor' NOT NULL;--> statement-breakpoint
ALTER TABLE "concepts" ADD COLUMN "client_status" text DEFAULT 'pending_for_approval' NOT NULL;