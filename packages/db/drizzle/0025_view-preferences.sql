CREATE TABLE "user_view_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_by" text,
	"deleted_at" timestamp with time zone,
	"user_id" text NOT NULL,
	"table_key" text NOT NULL,
	"view_type" text DEFAULT 'grid' NOT NULL,
	"kanban_group_by_field" text,
	CONSTRAINT "uq_user_table_view" UNIQUE("user_id","brand_id","table_key")
);
