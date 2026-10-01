CREATE TABLE "user_table_views" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_by" text,
	"deleted_at" timestamp with time zone,
	"user_id" text NOT NULL,
	"table_key" text NOT NULL,
	"name" text NOT NULL,
	"view_type" text DEFAULT 'grid' NOT NULL,
	"visible_fields" jsonb,
	"field_order" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"frozen_fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sort" jsonb,
	"filter" text DEFAULT '' NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE INDEX "user_table_views_user_table_idx" ON "user_table_views" USING btree ("user_id","table_key");
