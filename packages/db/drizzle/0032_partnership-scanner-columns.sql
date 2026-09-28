ALTER TABLE "creators" ADD COLUMN "slack_notified" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "creators" ADD COLUMN "current_period_start" timestamp with time zone;
