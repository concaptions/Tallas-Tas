CREATE TABLE "campaigns_offers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_by" text,
	"deleted_at" timestamp with time zone,
	"template_row_id" uuid,
	"overridden_fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"custom_fields" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"name" text NOT NULL,
	"holiday" text,
	"discount_offer" text,
	"code" text,
	"official_date" date,
	"country" text,
	"description" text,
	"confirmed_by_client" boolean DEFAULT false NOT NULL,
	"launched" boolean DEFAULT false NOT NULL,
	"ads_launch_date" date,
	"ads_end_date" date,
	"product_id" uuid,
	"legacy_airtable_id" text
);
--> statement-breakpoint
ALTER TABLE "campaigns_offers" ADD CONSTRAINT "campaigns_offers_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns_offers" ADD CONSTRAINT "campaigns_offers_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "campaigns_offers_brand_id_idx" ON "campaigns_offers" USING btree ("brand_id");--> statement-breakpoint
CREATE INDEX "campaigns_offers_template_row_id_idx" ON "campaigns_offers" USING btree ("template_row_id");