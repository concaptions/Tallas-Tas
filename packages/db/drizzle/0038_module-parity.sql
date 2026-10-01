CREATE TABLE "copy_types" (
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
	"description" text,
	"legacy_airtable_id" text
);
--> statement-breakpoint
CREATE TABLE "youtube_copy" (
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
	"copy_number" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'pending_for_client_review' NOT NULL,
	"angle" text,
	"descriptions" text,
	"headline" text,
	"news_feed" text,
	"cta" text,
	"funnel" text,
	"client_comment" text,
	"used" boolean DEFAULT false NOT NULL,
	"winning" boolean DEFAULT false NOT NULL,
	"meta_rating" integer,
	"legacy_airtable_id" text
);
--> statement-breakpoint
CREATE TABLE "sm_campaign_feed_tasks" (
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
	"task_name" text NOT NULL,
	"platform" text,
	"due_date" timestamp with time zone,
	"status" text,
	"notes" text,
	"legacy_airtable_id" text
);
--> statement-breakpoint
CREATE TABLE "creative_reporting" (
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
	"name_angle_offer" text NOT NULL,
	"brief_id" uuid,
	"notes" text,
	"ad_design" jsonb,
	"ad_link" text,
	"ctr" numeric(6, 4),
	"thumb_stop_rate" numeric(6, 2),
	"results" numeric(10, 1),
	"cpa" numeric(10, 2),
	"target_cpa" numeric(10, 2),
	"roas" numeric(8, 2),
	"target_roas" numeric(8, 1),
	"legacy_airtable_id" text
);
--> statement-breakpoint
CREATE TABLE "creative_modules" (
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
	"module_name" text NOT NULL,
	"foreplay_link" text,
	"legacy_airtable_id" text
);
--> statement-breakpoint
CREATE TABLE "creative_sheet_items" (
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
	"brief_id" uuid,
	"internal_status" text,
	"status" text,
	"qa_checklist_doc" jsonb,
	"qa_video_editor" boolean DEFAULT false NOT NULL,
	"qa_designer" boolean DEFAULT false NOT NULL,
	"qa_strategist" boolean DEFAULT false NOT NULL,
	"client_comments" text,
	"used" boolean DEFAULT false NOT NULL,
	"denied_revisions_needed" boolean DEFAULT false NOT NULL,
	"winning" text,
	"spell_check_requested" boolean DEFAULT false NOT NULL,
	"spelling_feedback" text,
	"legacy_airtable_id" text
);
--> statement-breakpoint
CREATE TABLE "email_campaigns" (
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
	"campaign_purpose" text,
	"status" text,
	"send_date" date,
	"copywriting" text,
	"assignee_id" text,
	"copy_link" text,
	"design" jsonb,
	"klaviyo_link" text,
	"assets" jsonb,
	"type" text,
	"channel" text,
	"legacy_airtable_id" text
);
--> statement-breakpoint
CREATE TABLE "email_flows" (
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
	"flow_name" text NOT NULL,
	"expected_setup_date" date,
	"flow_purpose" text,
	"status" text,
	"copywriting" text,
	"design" jsonb,
	"klaviyo_link" text,
	"type" text,
	"inspo" jsonb,
	"assignee_id" text,
	"legacy_airtable_id" text
);
--> statement-breakpoint
CREATE TABLE "copywriting_copy_types" (
	"copy_id" uuid NOT NULL,
	"copy_type_id" uuid NOT NULL,
	CONSTRAINT "copywriting_copy_types_copy_id_copy_type_id_pk" PRIMARY KEY("copy_id","copy_type_id")
);
--> statement-breakpoint
CREATE TABLE "youtube_copy_collections" (
	"youtube_copy_id" uuid NOT NULL,
	"collection_id" uuid NOT NULL,
	CONSTRAINT "youtube_copy_collections_youtube_copy_id_collection_id_pk" PRIMARY KEY("youtube_copy_id","collection_id")
);
--> statement-breakpoint
CREATE TABLE "youtube_copy_products" (
	"youtube_copy_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	CONSTRAINT "youtube_copy_products_youtube_copy_id_product_id_pk" PRIMARY KEY("youtube_copy_id","product_id")
);
--> statement-breakpoint
CREATE TABLE "youtube_copy_campaigns" (
	"youtube_copy_id" uuid NOT NULL,
	"campaign_offer_id" uuid NOT NULL,
	CONSTRAINT "youtube_copy_campaigns_youtube_copy_id_campaign_offer_id_pk" PRIMARY KEY("youtube_copy_id","campaign_offer_id")
);
--> statement-breakpoint
CREATE TABLE "youtube_copy_copy_types" (
	"youtube_copy_id" uuid NOT NULL,
	"copy_type_id" uuid NOT NULL,
	CONSTRAINT "youtube_copy_copy_types_youtube_copy_id_copy_type_id_pk" PRIMARY KEY("youtube_copy_id","copy_type_id")
);
--> statement-breakpoint
CREATE TABLE "copywriting_campaigns" (
	"copy_id" uuid NOT NULL,
	"campaign_offer_id" uuid NOT NULL,
	CONSTRAINT "copywriting_campaigns_copy_id_campaign_offer_id_pk" PRIMARY KEY("copy_id","campaign_offer_id")
);
--> statement-breakpoint
CREATE TABLE "campaign_concepts" (
	"campaign_offer_id" uuid NOT NULL,
	"concept_id" uuid NOT NULL,
	CONSTRAINT "campaign_concepts_campaign_offer_id_concept_id_pk" PRIMARY KEY("campaign_offer_id","concept_id")
);
--> statement-breakpoint
ALTER TABLE "copy_types" ADD CONSTRAINT "copy_types_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "youtube_copy" ADD CONSTRAINT "youtube_copy_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "copywriting_copy_types" ADD CONSTRAINT "copywriting_copy_types_copy_id_copywriting_id_fk" FOREIGN KEY ("copy_id") REFERENCES "public"."copywriting"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "copywriting_copy_types" ADD CONSTRAINT "copywriting_copy_types_copy_type_id_copy_types_id_fk" FOREIGN KEY ("copy_type_id") REFERENCES "public"."copy_types"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "youtube_copy_collections" ADD CONSTRAINT "youtube_copy_collections_youtube_copy_id_youtube_copy_id_fk" FOREIGN KEY ("youtube_copy_id") REFERENCES "public"."youtube_copy"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "youtube_copy_collections" ADD CONSTRAINT "youtube_copy_collections_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "youtube_copy_products" ADD CONSTRAINT "youtube_copy_products_youtube_copy_id_youtube_copy_id_fk" FOREIGN KEY ("youtube_copy_id") REFERENCES "public"."youtube_copy"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "youtube_copy_products" ADD CONSTRAINT "youtube_copy_products_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "youtube_copy_campaigns" ADD CONSTRAINT "youtube_copy_campaigns_youtube_copy_id_youtube_copy_id_fk" FOREIGN KEY ("youtube_copy_id") REFERENCES "public"."youtube_copy"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "youtube_copy_campaigns" ADD CONSTRAINT "youtube_copy_campaigns_campaign_offer_id_campaigns_offers_id_fk" FOREIGN KEY ("campaign_offer_id") REFERENCES "public"."campaigns_offers"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "youtube_copy_copy_types" ADD CONSTRAINT "youtube_copy_copy_types_youtube_copy_id_youtube_copy_id_fk" FOREIGN KEY ("youtube_copy_id") REFERENCES "public"."youtube_copy"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "youtube_copy_copy_types" ADD CONSTRAINT "youtube_copy_copy_types_copy_type_id_copy_types_id_fk" FOREIGN KEY ("copy_type_id") REFERENCES "public"."copy_types"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "copywriting_campaigns" ADD CONSTRAINT "copywriting_campaigns_copy_id_copywriting_id_fk" FOREIGN KEY ("copy_id") REFERENCES "public"."copywriting"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "copywriting_campaigns" ADD CONSTRAINT "copywriting_campaigns_campaign_offer_id_campaigns_offers_id_fk" FOREIGN KEY ("campaign_offer_id") REFERENCES "public"."campaigns_offers"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "campaign_concepts" ADD CONSTRAINT "campaign_concepts_campaign_offer_id_campaigns_offers_id_fk" FOREIGN KEY ("campaign_offer_id") REFERENCES "public"."campaigns_offers"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "campaign_concepts" ADD CONSTRAINT "campaign_concepts_concept_id_concepts_id_fk" FOREIGN KEY ("concept_id") REFERENCES "public"."concepts"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "copy_types_brand_id_idx" ON "copy_types" USING btree ("brand_id");
--> statement-breakpoint
CREATE INDEX "copy_types_template_row_id_idx" ON "copy_types" USING btree ("template_row_id");
--> statement-breakpoint
CREATE INDEX "youtube_copy_brand_id_idx" ON "youtube_copy" USING btree ("brand_id");
--> statement-breakpoint
CREATE INDEX "youtube_copy_template_row_id_idx" ON "youtube_copy" USING btree ("template_row_id");
--> statement-breakpoint
ALTER TABLE "sm_campaign_feed_tasks" ADD CONSTRAINT "sm_campaign_feed_tasks_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "sm_campaign_feed_tasks_brand_id_idx" ON "sm_campaign_feed_tasks" USING btree ("brand_id");
--> statement-breakpoint
CREATE INDEX "sm_campaign_feed_tasks_template_row_id_idx" ON "sm_campaign_feed_tasks" USING btree ("template_row_id");
--> statement-breakpoint
ALTER TABLE "creative_reporting" ADD CONSTRAINT "creative_reporting_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "creative_reporting" ADD CONSTRAINT "creative_reporting_brief_id_creative_briefs_id_fk" FOREIGN KEY ("brief_id") REFERENCES "public"."creative_briefs"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "creative_reporting_brand_id_idx" ON "creative_reporting" USING btree ("brand_id");
--> statement-breakpoint
CREATE INDEX "creative_reporting_template_row_id_idx" ON "creative_reporting" USING btree ("template_row_id");
--> statement-breakpoint
CREATE INDEX "creative_reporting_brief_id_idx" ON "creative_reporting" USING btree ("brief_id");
--> statement-breakpoint
ALTER TABLE "creative_modules" ADD CONSTRAINT "creative_modules_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "creative_modules_brand_id_idx" ON "creative_modules" USING btree ("brand_id");
--> statement-breakpoint
CREATE INDEX "creative_modules_template_row_id_idx" ON "creative_modules" USING btree ("template_row_id");
--> statement-breakpoint
CREATE TABLE "creative_module_angles" (
	"module_id" uuid NOT NULL,
	"angle_id" uuid NOT NULL,
	CONSTRAINT "creative_module_angles_module_id_angle_id_pk" PRIMARY KEY("module_id","angle_id")
);
--> statement-breakpoint
ALTER TABLE "creative_module_angles" ADD CONSTRAINT "creative_module_angles_module_id_creative_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."creative_modules"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "creative_module_angles" ADD CONSTRAINT "creative_module_angles_angle_id_angles_id_fk" FOREIGN KEY ("angle_id") REFERENCES "public"."angles"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE TABLE "creative_module_designs" (
	"module_id" uuid NOT NULL,
	"brief_id" uuid NOT NULL,
	CONSTRAINT "creative_module_designs_module_id_brief_id_pk" PRIMARY KEY("module_id","brief_id")
);
--> statement-breakpoint
ALTER TABLE "creative_module_designs" ADD CONSTRAINT "creative_module_designs_module_id_creative_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."creative_modules"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "creative_module_designs" ADD CONSTRAINT "creative_module_designs_brief_id_creative_briefs_id_fk" FOREIGN KEY ("brief_id") REFERENCES "public"."creative_briefs"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "creative_sheet_items" ADD CONSTRAINT "creative_sheet_items_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "creative_sheet_items" ADD CONSTRAINT "creative_sheet_items_brief_id_creative_briefs_id_fk" FOREIGN KEY ("brief_id") REFERENCES "public"."creative_briefs"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "creative_sheet_items_brand_id_idx" ON "creative_sheet_items" USING btree ("brand_id");
--> statement-breakpoint
CREATE INDEX "creative_sheet_items_template_row_id_idx" ON "creative_sheet_items" USING btree ("template_row_id");
--> statement-breakpoint
CREATE INDEX "creative_sheet_items_brief_id_idx" ON "creative_sheet_items" USING btree ("brief_id");
--> statement-breakpoint
CREATE TABLE "email_campaign_campaigns" (
	"email_campaign_id" uuid NOT NULL,
	"campaign_offer_id" uuid NOT NULL,
	CONSTRAINT "email_campaign_campaigns_email_campaign_id_campaign_offer_id_pk" PRIMARY KEY("email_campaign_id","campaign_offer_id")
);
--> statement-breakpoint
CREATE TABLE "email_campaign_products" (
	"email_campaign_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	CONSTRAINT "email_campaign_products_email_campaign_id_product_id_pk" PRIMARY KEY("email_campaign_id","product_id")
);
--> statement-breakpoint
CREATE TABLE "email_campaign_collections" (
	"email_campaign_id" uuid NOT NULL,
	"collection_id" uuid NOT NULL,
	CONSTRAINT "email_campaign_collections_email_campaign_id_collection_id_pk" PRIMARY KEY("email_campaign_id","collection_id")
);
--> statement-breakpoint
CREATE TABLE "email_flow_campaigns" (
	"email_flow_id" uuid NOT NULL,
	"campaign_offer_id" uuid NOT NULL,
	CONSTRAINT "email_flow_campaigns_email_flow_id_campaign_offer_id_pk" PRIMARY KEY("email_flow_id","campaign_offer_id")
);
--> statement-breakpoint
ALTER TABLE "email_campaigns" ADD CONSTRAINT "email_campaigns_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "email_flows" ADD CONSTRAINT "email_flows_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "email_campaign_campaigns" ADD CONSTRAINT "email_campaign_campaigns_email_campaign_id_email_campaigns_id_fk" FOREIGN KEY ("email_campaign_id") REFERENCES "public"."email_campaigns"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "email_campaign_campaigns" ADD CONSTRAINT "email_campaign_campaigns_campaign_offer_id_campaigns_offers_id_fk" FOREIGN KEY ("campaign_offer_id") REFERENCES "public"."campaigns_offers"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "email_campaign_products" ADD CONSTRAINT "email_campaign_products_email_campaign_id_email_campaigns_id_fk" FOREIGN KEY ("email_campaign_id") REFERENCES "public"."email_campaigns"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "email_campaign_products" ADD CONSTRAINT "email_campaign_products_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "email_campaign_collections" ADD CONSTRAINT "email_campaign_collections_email_campaign_id_email_campaigns_id_fk" FOREIGN KEY ("email_campaign_id") REFERENCES "public"."email_campaigns"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "email_campaign_collections" ADD CONSTRAINT "email_campaign_collections_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "email_flow_campaigns" ADD CONSTRAINT "email_flow_campaigns_email_flow_id_email_flows_id_fk" FOREIGN KEY ("email_flow_id") REFERENCES "public"."email_flows"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "email_flow_campaigns" ADD CONSTRAINT "email_flow_campaigns_campaign_offer_id_campaigns_offers_id_fk" FOREIGN KEY ("campaign_offer_id") REFERENCES "public"."campaigns_offers"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "email_campaigns_brand_id_idx" ON "email_campaigns" USING btree ("brand_id");
--> statement-breakpoint
CREATE INDEX "email_campaigns_template_row_id_idx" ON "email_campaigns" USING btree ("template_row_id");
--> statement-breakpoint
CREATE INDEX "email_flows_brand_id_idx" ON "email_flows" USING btree ("brand_id");
--> statement-breakpoint
CREATE INDEX "email_flows_template_row_id_idx" ON "email_flows" USING btree ("template_row_id");
--> statement-breakpoint
ALTER TABLE "campaigns_offers" ADD COLUMN "promotional_ideas" text;
