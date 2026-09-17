CREATE TABLE "promotion_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_by" text,
	"deleted_at" timestamp with time zone,
	"table_name" text NOT NULL,
	"row_id" uuid,
	"field_name" text NOT NULL,
	"current_value" text NOT NULL,
	"proposed_value" text NOT NULL,
	"requested_by" text NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"reviewed_by" text,
	"reviewed_at" timestamp with time zone,
	"review_note" text
);
--> statement-breakpoint
ALTER TABLE "promotion_requests" ADD CONSTRAINT "promotion_requests_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "promotion_requests_brand_id_idx" ON "promotion_requests" USING btree ("brand_id");--> statement-breakpoint
CREATE INDEX "promotion_requests_status_requested_at_idx" ON "promotion_requests" USING btree ("status","requested_at");