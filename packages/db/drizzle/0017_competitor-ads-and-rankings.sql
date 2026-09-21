CREATE TABLE "competitor_ads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_by" text,
	"deleted_at" timestamp with time zone,
	"platform" text NOT NULL,
	"advertiser_name" text NOT NULL,
	"ad_url" text NOT NULL,
	"headline" text,
	"body_text" text,
	"format" text NOT NULL,
	"estimated_spend" text,
	"days_active" integer,
	"first_seen" text NOT NULL,
	"last_seen" text,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "creator_rankings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_by" text,
	"deleted_at" timestamp with time zone,
	"creator_id" uuid NOT NULL,
	"creator_name" text NOT NULL,
	"total_ads" integer NOT NULL,
	"total_spend" numeric(12, 2) NOT NULL,
	"total_conversions" integer NOT NULL,
	"avg_roas" numeric(8, 2),
	"avg_cpa" numeric(10, 2),
	"rank" integer NOT NULL,
	"period_label" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "competitor_ads" ADD CONSTRAINT "competitor_ads_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_rankings" ADD CONSTRAINT "creator_rankings_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_rankings" ADD CONSTRAINT "creator_rankings_creator_id_creators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creators"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "competitor_ads_brand_id_idx" ON "competitor_ads" USING btree ("brand_id");--> statement-breakpoint
CREATE INDEX "creator_rankings_brand_id_idx" ON "creator_rankings" USING btree ("brand_id");--> statement-breakpoint
CREATE INDEX "creator_rankings_creator_id_idx" ON "creator_rankings" USING btree ("creator_id");