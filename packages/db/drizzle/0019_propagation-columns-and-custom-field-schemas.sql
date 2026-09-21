CREATE TABLE "custom_field_schemas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_by" text,
	"deleted_at" timestamp with time zone,
	"table_name" text NOT NULL,
	"field_key" text NOT NULL,
	"field_type" text NOT NULL,
	"field_label" text NOT NULL,
	"options" text,
	"sort_order" text DEFAULT '0' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "angles" ADD COLUMN "template_row_id" uuid;--> statement-breakpoint
ALTER TABLE "angles" ADD COLUMN "overridden_fields" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "angles" ADD COLUMN "custom_fields" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "creative_briefs" ADD COLUMN "template_row_id" uuid;--> statement-breakpoint
ALTER TABLE "creative_briefs" ADD COLUMN "overridden_fields" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "creative_briefs" ADD COLUMN "custom_fields" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "concepts" ADD COLUMN "template_row_id" uuid;--> statement-breakpoint
ALTER TABLE "concepts" ADD COLUMN "overridden_fields" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "concepts" ADD COLUMN "custom_fields" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "copywriting" ADD COLUMN "template_row_id" uuid;--> statement-breakpoint
ALTER TABLE "copywriting" ADD COLUMN "overridden_fields" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "copywriting" ADD COLUMN "custom_fields" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "creators" ADD COLUMN "template_row_id" uuid;--> statement-breakpoint
ALTER TABLE "creators" ADD COLUMN "overridden_fields" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "creators" ADD COLUMN "custom_fields" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "personas" ADD COLUMN "template_row_id" uuid;--> statement-breakpoint
ALTER TABLE "personas" ADD COLUMN "overridden_fields" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "personas" ADD COLUMN "custom_fields" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "template_row_id" uuid;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "overridden_fields" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "custom_fields" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "custom_field_schemas" ADD CONSTRAINT "custom_field_schemas_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "custom_field_schemas_brand_id_idx" ON "custom_field_schemas" USING btree ("brand_id");--> statement-breakpoint
CREATE INDEX "custom_field_schemas_table_name_idx" ON "custom_field_schemas" USING btree ("brand_id","table_name");--> statement-breakpoint
CREATE INDEX "angles_template_row_id_idx" ON "angles" USING btree ("template_row_id");--> statement-breakpoint
CREATE INDEX "creative_briefs_template_row_id_idx" ON "creative_briefs" USING btree ("template_row_id");--> statement-breakpoint
CREATE INDEX "concepts_template_row_id_idx" ON "concepts" USING btree ("template_row_id");--> statement-breakpoint
CREATE INDEX "copywriting_template_row_id_idx" ON "copywriting" USING btree ("template_row_id");--> statement-breakpoint
CREATE INDEX "creators_template_row_id_idx" ON "creators" USING btree ("template_row_id");--> statement-breakpoint
CREATE INDEX "personas_template_row_id_idx" ON "personas" USING btree ("template_row_id");--> statement-breakpoint
CREATE INDEX "products_template_row_id_idx" ON "products" USING btree ("template_row_id");