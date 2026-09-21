CREATE TABLE "onboarding_forms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_by" text,
	"deleted_at" timestamp with time zone,
	"title" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"fields_json" text DEFAULT '[]' NOT NULL,
	"submissions_count" text DEFAULT '0' NOT NULL,
	"share_token" text NOT NULL,
	CONSTRAINT "onboarding_forms_share_token_unique" UNIQUE("share_token")
);
--> statement-breakpoint
CREATE TABLE "upload_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_by" text,
	"deleted_at" timestamp with time zone,
	"token" text NOT NULL,
	"label" text NOT NULL,
	"recipient_name" text,
	"recipient_email" text,
	"max_uploads" text,
	"expires_at" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"uploads_used" text DEFAULT '0' NOT NULL,
	"notes" text,
	CONSTRAINT "upload_links_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "onboarding_forms" ADD CONSTRAINT "onboarding_forms_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "upload_links" ADD CONSTRAINT "upload_links_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "onboarding_forms_brand_id_idx" ON "onboarding_forms" USING btree ("brand_id");--> statement-breakpoint
CREATE INDEX "upload_links_brand_id_idx" ON "upload_links" USING btree ("brand_id");--> statement-breakpoint
CREATE INDEX "upload_links_token_idx" ON "upload_links" USING btree ("token");