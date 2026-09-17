CREATE TYPE "public"."copy_cta" AS ENUM('Shop Now', 'Learn More', 'Get Offer', 'Get Directions', 'Visit Us', 'Download');--> statement-breakpoint
CREATE TABLE "copywriting" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_by" text,
	"deleted_at" timestamp with time zone,
	"creative_brief_id" uuid,
	"copy_number" integer DEFAULT 1 NOT NULL,
	"primary_copy" text,
	"headline" text,
	"link_description" text,
	"cta" text DEFAULT 'Shop Now' NOT NULL,
	"status" text DEFAULT 'pending_for_client_review' NOT NULL,
	"client_comment" text
);
--> statement-breakpoint
ALTER TABLE "copywriting" ADD CONSTRAINT "copywriting_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "copywriting" ADD CONSTRAINT "copywriting_creative_brief_id_creative_briefs_id_fk" FOREIGN KEY ("creative_brief_id") REFERENCES "public"."creative_briefs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "copywriting_brand_id_idx" ON "copywriting" USING btree ("brand_id");--> statement-breakpoint
CREATE INDEX "copywriting_creative_brief_id_idx" ON "copywriting" USING btree ("creative_brief_id");