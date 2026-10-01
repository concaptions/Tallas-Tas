ALTER TABLE "angles" ADD COLUMN "status" text;--> statement-breakpoint
ALTER TABLE "concepts" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "concepts" ADD COLUMN "pain_points" text;--> statement-breakpoint
ALTER TABLE "concepts" ADD COLUMN "usp" text;--> statement-breakpoint
ALTER TABLE "concepts" ADD COLUMN "client_comments" text;--> statement-breakpoint
ALTER TABLE "creators" ADD COLUMN "payment_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "creators" ADD COLUMN "creator_info_request" text;
