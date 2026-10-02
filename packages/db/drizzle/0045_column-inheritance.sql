CREATE TABLE IF NOT EXISTS "column_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_by" text,
	"deleted_at" timestamp with time zone,
	"table_key" text NOT NULL,
	"column_key" text NOT NULL,
	"display_label" text NOT NULL,
	"display_order" integer NOT NULL,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"is_detached" boolean DEFAULT false NOT NULL,
	"field_type" text,
	"source" text DEFAULT 'parent' NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "column_definitions" ADD CONSTRAINT "column_definitions_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "column_definitions_brand_table_idx" ON "column_definitions" USING btree ("brand_id","table_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "column_definitions_table_key_idx" ON "column_definitions" USING btree ("table_key");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "column_definitions_brand_table_column_unique" ON "column_definitions" USING btree ("brand_id","table_key","column_key");
--> statement-breakpoint
DO $$ BEGIN
	IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'personas' AND column_name = 'passion') THEN
		ALTER TABLE "personas" ADD COLUMN "passion" text;
	END IF;
END $$;
