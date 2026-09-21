CREATE TABLE "ad_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_by" text,
	"deleted_at" timestamp with time zone,
	"brief_id" uuid,
	"concept_id" uuid,
	"meta_ad_id" text,
	"ad_name" text NOT NULL,
	"spend" numeric(12, 2) NOT NULL,
	"impressions" integer NOT NULL,
	"clicks" integer NOT NULL,
	"conversions" integer NOT NULL,
	"ctr" numeric(6, 4),
	"cpc" numeric(10, 2),
	"cpa" numeric(10, 2),
	"roas" numeric(8, 2),
	"date_range" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ad_metrics" ADD CONSTRAINT "ad_metrics_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ad_metrics" ADD CONSTRAINT "ad_metrics_brief_id_creative_briefs_id_fk" FOREIGN KEY ("brief_id") REFERENCES "public"."creative_briefs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ad_metrics" ADD CONSTRAINT "ad_metrics_concept_id_concepts_id_fk" FOREIGN KEY ("concept_id") REFERENCES "public"."concepts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ad_metrics_brand_id_idx" ON "ad_metrics" USING btree ("brand_id");--> statement-breakpoint
CREATE INDEX "ad_metrics_concept_id_idx" ON "ad_metrics" USING btree ("concept_id");--> statement-breakpoint
CREATE INDEX "ad_metrics_brief_id_idx" ON "ad_metrics" USING btree ("brief_id");