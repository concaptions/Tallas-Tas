CREATE TABLE "client_asset_folders" (
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
	"location_url" text,
	"legacy_airtable_id" text
);
--> statement-breakpoint
ALTER TABLE "client_asset_folders" ADD CONSTRAINT "client_asset_folders_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "client_asset_folders_brand_id_idx" ON "client_asset_folders" USING btree ("brand_id");
--> statement-breakpoint
CREATE INDEX "client_asset_folders_template_row_id_idx" ON "client_asset_folders" USING btree ("template_row_id");
--> statement-breakpoint
CREATE TABLE "brief_asset_folders" (
	"brief_id" uuid NOT NULL,
	"folder_id" uuid NOT NULL,
	CONSTRAINT "brief_asset_folders_brief_id_folder_id_pk" PRIMARY KEY("brief_id","folder_id")
);
--> statement-breakpoint
ALTER TABLE "brief_asset_folders" ADD CONSTRAINT "brief_asset_folders_brief_id_creative_briefs_id_fk" FOREIGN KEY ("brief_id") REFERENCES "public"."creative_briefs"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "brief_asset_folders" ADD CONSTRAINT "brief_asset_folders_folder_id_client_asset_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."client_asset_folders"("id") ON DELETE cascade ON UPDATE no action;
