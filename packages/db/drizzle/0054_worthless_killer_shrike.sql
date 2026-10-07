CREATE TABLE "creator_registry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_by" text,
	"deleted_at" timestamp with time zone,
	"name" text NOT NULL,
	"instagram_username" text,
	"profile_pic_url" text,
	"creator_link" text,
	"platform" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"age_bracket" text,
	"gender" text,
	"ethnicity" text,
	"shipping_location" text,
	"total_brands" integer DEFAULT 0 NOT NULL,
	"total_projects" integer DEFAULT 0 NOT NULL,
	"avg_rating" integer,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"notes" text,
	"normalized_instagram" text,
	"legacy_airtable_id" text,
	CONSTRAINT "creator_registry_normalized_instagram_unique" UNIQUE("normalized_instagram"),
	CONSTRAINT "creator_registry_global" CHECK ("creator_registry"."brand_id" is null)
);
--> statement-breakpoint
ALTER TABLE "creators" ADD COLUMN "registry_creator_id" uuid;--> statement-breakpoint
CREATE INDEX "creator_registry_name_idx" ON "creator_registry" USING btree ("name");--> statement-breakpoint
CREATE INDEX "creator_registry_instagram_idx" ON "creator_registry" USING btree ("instagram_username");--> statement-breakpoint
CREATE INDEX "creator_registry_normalized_ig_idx" ON "creator_registry" USING btree ("normalized_instagram");--> statement-breakpoint
ALTER TABLE "creators" ADD CONSTRAINT "creators_registry_creator_id_creator_registry_id_fk" FOREIGN KEY ("registry_creator_id") REFERENCES "public"."creator_registry"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "creators_registry_creator_id_idx" ON "creators" USING btree ("registry_creator_id");