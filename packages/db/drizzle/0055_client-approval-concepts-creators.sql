ALTER TABLE "concepts" ADD COLUMN "client_approval_status" text;--> statement-breakpoint
ALTER TABLE "concepts" ADD COLUMN "client_approval_note" text;--> statement-breakpoint
ALTER TABLE "concepts" ADD COLUMN "client_approval_status_updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "creators" ADD COLUMN "client_approval_status" text;--> statement-breakpoint
ALTER TABLE "creators" ADD COLUMN "client_approval_note" text;--> statement-breakpoint
ALTER TABLE "creators" ADD COLUMN "client_approval_status_updated_at" timestamp with time zone;
