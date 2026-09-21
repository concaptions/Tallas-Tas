ALTER TYPE "public"."copy_cta" ADD VALUE IF NOT EXISTS 'Sign Up';--> statement-breakpoint
ALTER TYPE "public"."copy_cta" ADD VALUE IF NOT EXISTS 'Subscribe';--> statement-breakpoint
ALTER TYPE "public"."copy_cta" ADD VALUE IF NOT EXISTS 'Book Now';--> statement-breakpoint
ALTER TYPE "public"."copy_cta" ADD VALUE IF NOT EXISTS 'Contact Us';--> statement-breakpoint
ALTER TABLE "angles" ADD COLUMN "brief_url" text;--> statement-breakpoint
ALTER TABLE "angles" ADD COLUMN "exact_script_url" text;--> statement-breakpoint
ALTER TABLE "creative_briefs" ADD COLUMN "angle_id" uuid;--> statement-breakpoint
ALTER TABLE "creative_briefs" ADD COLUMN "product_id" uuid;--> statement-breakpoint
ALTER TABLE "creative_briefs" ADD COLUMN "spelling_feedback_2" text;--> statement-breakpoint
ALTER TABLE "creative_briefs" ADD COLUMN "click_for_ai_spell_checker" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "creative_briefs" ADD COLUMN "ad_content" text;--> statement-breakpoint
ALTER TABLE "creative_briefs" ADD COLUMN "inspiration" text;--> statement-breakpoint
ALTER TABLE "creative_briefs" ADD COLUMN "inspiration_image" jsonb;--> statement-breakpoint
ALTER TABLE "creative_briefs" ADD COLUMN "qa_checklist_doc" jsonb;--> statement-breakpoint
ALTER TABLE "creative_briefs" ADD COLUMN "design_file" jsonb;--> statement-breakpoint
ALTER TABLE "creative_briefs" ADD COLUMN "script_and_brief_breakdown" jsonb;--> statement-breakpoint
ALTER TABLE "creative_briefs" ADD COLUMN "language" text;--> statement-breakpoint
ALTER TABLE "creative_briefs" ADD COLUMN "offer" text;--> statement-breakpoint
ALTER TABLE "concepts" ADD COLUMN "approval_status" text;--> statement-breakpoint
ALTER TABLE "concepts" ADD COLUMN "formats_to_create" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "concepts" ADD COLUMN "production_status" text;--> statement-breakpoint
ALTER TABLE "concepts" ADD COLUMN "creator_id" uuid;--> statement-breakpoint
ALTER TABLE "copywriting" ADD COLUMN "product_id" uuid;--> statement-breakpoint
ALTER TABLE "copywriting" ADD COLUMN "funnel" text;--> statement-breakpoint
ALTER TABLE "copywriting" ADD COLUMN "used" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "copywriting" ADD COLUMN "winning" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "copywriting" ADD COLUMN "meta_rating" integer;--> statement-breakpoint
ALTER TABLE "copywriting" ADD COLUMN "click_for_ai_spell_checker" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "copywriting" ADD COLUMN "spelling_feedback" text;--> statement-breakpoint
ALTER TABLE "creators" ADD COLUMN "raw_assets_url" text;--> statement-breakpoint
ALTER TABLE "creators" ADD COLUMN "concept_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "creators" ADD COLUMN "product_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "themes" ADD COLUMN "assignee_id" text;--> statement-breakpoint
ALTER TABLE "themes" ADD COLUMN "status" text;--> statement-breakpoint
ALTER TABLE "themes" ADD COLUMN "attachments" jsonb;--> statement-breakpoint
ALTER TABLE "themes" ADD COLUMN "ai_attachment_summary" text;--> statement-breakpoint
ALTER TABLE "creative_briefs" ADD CONSTRAINT "creative_briefs_angle_id_angles_id_fk" FOREIGN KEY ("angle_id") REFERENCES "public"."angles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creative_briefs" ADD CONSTRAINT "creative_briefs_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concepts" ADD CONSTRAINT "concepts_creator_id_creators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creators"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "copywriting" ADD CONSTRAINT "copywriting_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;