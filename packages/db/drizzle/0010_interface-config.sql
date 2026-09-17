CREATE TABLE "interface_fields" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_by" text,
	"deleted_at" timestamp with time zone,
	"page_id" uuid NOT NULL,
	"field_name" text NOT NULL,
	"label" text NOT NULL,
	"visible" boolean DEFAULT true NOT NULL,
	"client_editable" boolean DEFAULT false NOT NULL,
	"position" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interface_pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_by" text,
	"deleted_at" timestamp with time zone,
	"page_key" text NOT NULL,
	"label" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"position" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "interface_fields" ADD CONSTRAINT "interface_fields_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interface_fields" ADD CONSTRAINT "interface_fields_page_id_interface_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."interface_pages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interface_pages" ADD CONSTRAINT "interface_pages_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "interface_fields_brand_id_idx" ON "interface_fields" USING btree ("brand_id");--> statement-breakpoint
CREATE INDEX "interface_fields_page_id_idx" ON "interface_fields" USING btree ("page_id");--> statement-breakpoint
CREATE INDEX "interface_pages_brand_id_idx" ON "interface_pages" USING btree ("brand_id");--> statement-breakpoint
CREATE INDEX "interface_pages_brand_position_idx" ON "interface_pages" USING btree ("brand_id","position");