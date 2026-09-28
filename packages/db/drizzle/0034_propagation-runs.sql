CREATE TABLE "propagation_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_by" text,
	"deleted_at" timestamp with time zone,
	"template_brand_id" uuid NOT NULL,
	"table_name" text NOT NULL,
	"trigger" text NOT NULL,
	"template_row_id" uuid,
	"children_updated" integer DEFAULT 0 NOT NULL,
	"skipped" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "propagation_runs" ADD CONSTRAINT "propagation_runs_template_brand_id_brands_id_fk" FOREIGN KEY ("template_brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "propagation_runs_template_brand_id_idx" ON "propagation_runs" USING btree ("template_brand_id");--> statement-breakpoint
CREATE INDEX "propagation_runs_table_name_idx" ON "propagation_runs" USING btree ("table_name");
