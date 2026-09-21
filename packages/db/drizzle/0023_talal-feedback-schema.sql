CREATE TABLE "collaboration_instances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_by" text,
	"deleted_at" timestamp with time zone,
	"creator_id" uuid NOT NULL,
	"concept_id" uuid,
	"brief_id" uuid,
	"cost_usd" integer,
	"start_date" timestamp with time zone,
	"end_date" timestamp with time zone,
	"internal_status" text DEFAULT 'request' NOT NULL,
	"client_status" text DEFAULT 'pending_for_approval' NOT NULL,
	"assets_status" text DEFAULT 'pending_for_cs_approval' NOT NULL,
	"notes" text,
	"legacy_airtable_id" text
);
--> statement-breakpoint
ALTER TABLE "copywriting" ADD COLUMN "concept_id" uuid;--> statement-breakpoint
ALTER TABLE "creators" ADD COLUMN "cost_usd" integer;--> statement-breakpoint
ALTER TABLE "themes" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "collaboration_instances" ADD CONSTRAINT "collaboration_instances_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collaboration_instances" ADD CONSTRAINT "collaboration_instances_creator_id_creators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creators"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collaboration_instances" ADD CONSTRAINT "collaboration_instances_concept_id_concepts_id_fk" FOREIGN KEY ("concept_id") REFERENCES "public"."concepts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collaboration_instances" ADD CONSTRAINT "collaboration_instances_brief_id_creative_briefs_id_fk" FOREIGN KEY ("brief_id") REFERENCES "public"."creative_briefs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "collab_brand_id_idx" ON "collaboration_instances" USING btree ("brand_id");--> statement-breakpoint
CREATE INDEX "collab_creator_id_idx" ON "collaboration_instances" USING btree ("creator_id");--> statement-breakpoint
CREATE INDEX "collab_concept_id_idx" ON "collaboration_instances" USING btree ("concept_id");--> statement-breakpoint
ALTER TABLE "copywriting" ADD CONSTRAINT "copywriting_concept_id_concepts_id_fk" FOREIGN KEY ("concept_id") REFERENCES "public"."concepts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "copywriting_concept_id_idx" ON "copywriting" USING btree ("concept_id");