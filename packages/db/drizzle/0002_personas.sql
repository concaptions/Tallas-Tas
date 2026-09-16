CREATE TYPE "public"."awareness_stage" AS ENUM('unaware', 'problem_aware', 'solution_aware', 'product_aware', 'most_aware');--> statement-breakpoint
CREATE TABLE "angles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_by" text,
	"deleted_at" timestamp with time zone,
	"persona_id" uuid,
	"product_id" uuid,
	"name" text NOT NULL,
	"description" text,
	"pain_points" text,
	"usp" text,
	"type" text
);
--> statement-breakpoint
CREATE TABLE "concepts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_by" text,
	"deleted_at" timestamp with time zone,
	"angle_id" uuid,
	"theme_id" uuid,
	"name" text NOT NULL,
	"batch" text,
	"category" text,
	"concept_style" text,
	"hook_examples" text,
	"script_idea" text
);
--> statement-breakpoint
CREATE TABLE "personas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_by" text,
	"deleted_at" timestamp with time zone,
	"product_id" uuid,
	"name" text NOT NULL,
	"day_in_the_life" text,
	"demographic" text,
	"psychographic" text,
	"core_desires" text,
	"emotional_triggers" text,
	"pain_points" text,
	"success_factors" text,
	"perceived_barriers" text,
	"stage_of_awareness" "awareness_stage",
	"buying_triggers" text,
	"problem_challenge" text,
	"success_transformation" text,
	"trigger_words" text
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_by" text,
	"deleted_at" timestamp with time zone,
	"name" text NOT NULL,
	"link" text NOT NULL,
	"collection_link" text
);
--> statement-breakpoint
CREATE TABLE "themes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_by" text,
	"deleted_at" timestamp with time zone,
	"name" text NOT NULL,
	"reference_links" jsonb,
	"notes" text,
	CONSTRAINT "themes_global" CHECK ("themes"."brand_id" is null)
);
--> statement-breakpoint
ALTER TABLE "angles" ADD CONSTRAINT "angles_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "angles" ADD CONSTRAINT "angles_persona_id_personas_id_fk" FOREIGN KEY ("persona_id") REFERENCES "public"."personas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "angles" ADD CONSTRAINT "angles_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concepts" ADD CONSTRAINT "concepts_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concepts" ADD CONSTRAINT "concepts_angle_id_angles_id_fk" FOREIGN KEY ("angle_id") REFERENCES "public"."angles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concepts" ADD CONSTRAINT "concepts_theme_id_themes_id_fk" FOREIGN KEY ("theme_id") REFERENCES "public"."themes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personas" ADD CONSTRAINT "personas_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personas" ADD CONSTRAINT "personas_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "angles_brand_id_idx" ON "angles" USING btree ("brand_id");--> statement-breakpoint
CREATE INDEX "angles_persona_id_idx" ON "angles" USING btree ("persona_id");--> statement-breakpoint
CREATE INDEX "angles_product_id_idx" ON "angles" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "concepts_brand_id_idx" ON "concepts" USING btree ("brand_id");--> statement-breakpoint
CREATE INDEX "concepts_angle_id_idx" ON "concepts" USING btree ("angle_id");--> statement-breakpoint
CREATE INDEX "concepts_theme_id_idx" ON "concepts" USING btree ("theme_id");--> statement-breakpoint
CREATE INDEX "personas_brand_id_idx" ON "personas" USING btree ("brand_id");--> statement-breakpoint
CREATE INDEX "personas_product_id_idx" ON "personas" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "products_brand_id_idx" ON "products" USING btree ("brand_id");