CREATE TABLE "ai_characters" (
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
	"attachments" text,
	"status" text,
	"basic_info" text,
	"tone_of_voice" text,
	"voice_link" text,
	"personality_traits" text,
	"appearance" text,
	"traits_and_habits" text,
	"hobbies_and_lifestyle" text,
	"work_and_background" text,
	"why_promotes_brand" text,
	"legacy_airtable_id" text
);
--> statement-breakpoint
CREATE TABLE "collections" (
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
	"url" text,
	"campaign_id" uuid,
	"angle_id" uuid,
	"product_id" uuid,
	"creative_design_note" text,
	"copywriting_id" uuid,
	"creative_design_2_id" uuid,
	"legacy_airtable_id" text
);
--> statement-breakpoint
CREATE TABLE "competitive_research" (
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
	"type" text,
	"website" text,
	"instagram" text,
	"facebook_page" text,
	"meta_ads_library" text,
	"analysis" text,
	"legacy_airtable_id" text
);
--> statement-breakpoint
CREATE TABLE "creative_dimensions" (
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
	"dimensions" text,
	"link_description" text,
	"creative_design_id" uuid,
	"legacy_airtable_id" text
);
--> statement-breakpoint
ALTER TABLE "ai_characters" ADD CONSTRAINT "ai_characters_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "collections_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "collections_campaign_id_campaigns_offers_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns_offers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "collections_angle_id_angles_id_fk" FOREIGN KEY ("angle_id") REFERENCES "public"."angles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "collections_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competitive_research" ADD CONSTRAINT "competitive_research_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creative_dimensions" ADD CONSTRAINT "creative_dimensions_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_characters_brand_id_idx" ON "ai_characters" USING btree ("brand_id");--> statement-breakpoint
CREATE INDEX "ai_characters_template_row_id_idx" ON "ai_characters" USING btree ("template_row_id");--> statement-breakpoint
CREATE INDEX "collections_brand_id_idx" ON "collections" USING btree ("brand_id");--> statement-breakpoint
CREATE INDEX "collections_template_row_id_idx" ON "collections" USING btree ("template_row_id");--> statement-breakpoint
CREATE INDEX "competitive_research_brand_id_idx" ON "competitive_research" USING btree ("brand_id");--> statement-breakpoint
CREATE INDEX "competitive_research_template_row_id_idx" ON "competitive_research" USING btree ("template_row_id");--> statement-breakpoint
CREATE INDEX "creative_dimensions_brand_id_idx" ON "creative_dimensions" USING btree ("brand_id");--> statement-breakpoint
CREATE INDEX "creative_dimensions_template_row_id_idx" ON "creative_dimensions" USING btree ("template_row_id");