ALTER TABLE "creators" ADD COLUMN "partnership_ended_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "creators" ADD COLUMN "requires_attention" boolean DEFAULT false NOT NULL;
