CREATE TABLE "creative_briefs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_by" text,
	"deleted_at" timestamp with time zone,
	"concept_id" uuid,
	"name" text NOT NULL,
	"batch" text,
	"source" text DEFAULT 'TAS' NOT NULL,
	"funnel" text DEFAULT 'TOF' NOT NULL,
	"type" text DEFAULT 'Video' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"sequence" integer DEFAULT 1 NOT NULL,
	"priority" text,
	"assignee" text,
	"brief_to_design" text,
	"script_content" text,
	"elements_tested" text,
	"inspo_links" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"dimensions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"platform" text,
	"design_file_url" text,
	"qa_video_editor" boolean DEFAULT false NOT NULL,
	"qa_designer" boolean DEFAULT false NOT NULL,
	"qa_strategist" boolean DEFAULT false NOT NULL,
	"spelling_feedback" text,
	"internal_status" text DEFAULT 'sent_to_video_editor' NOT NULL,
	"client_status" text DEFAULT 'pending_for_approval' NOT NULL,
	"performance" text
);
--> statement-breakpoint
ALTER TABLE "creative_briefs" ADD CONSTRAINT "creative_briefs_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creative_briefs" ADD CONSTRAINT "creative_briefs_concept_id_concepts_id_fk" FOREIGN KEY ("concept_id") REFERENCES "public"."concepts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "creative_briefs_brand_id_idx" ON "creative_briefs" USING btree ("brand_id");--> statement-breakpoint
CREATE INDEX "creative_briefs_concept_id_idx" ON "creative_briefs" USING btree ("concept_id");