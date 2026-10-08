-- Phase 2 schema changes: client approval columns, collection FK, creator registry, client access tokens

-- Client approval columns on creative_sheet_items
ALTER TABLE "creative_sheet_items" ADD COLUMN "client_approval_status" text;
--> statement-breakpoint
ALTER TABLE "creative_sheet_items" ADD COLUMN "client_approval_note" text;
--> statement-breakpoint
ALTER TABLE "creative_sheet_items" ADD COLUMN "client_approval_status_updated_at" timestamptz;
--> statement-breakpoint

-- Collection FK and client approval columns on copywriting
ALTER TABLE "copywriting" ADD COLUMN "collection_id" uuid REFERENCES "collections"("id");
--> statement-breakpoint
ALTER TABLE "copywriting" ADD COLUMN "client_approval_status" text;
--> statement-breakpoint
ALTER TABLE "copywriting" ADD COLUMN "client_approval_note" text;
--> statement-breakpoint
ALTER TABLE "copywriting" ADD COLUMN "client_approval_status_updated_at" timestamptz;
--> statement-breakpoint

-- Missing FK indexes
CREATE INDEX IF NOT EXISTS "copywriting_product_id_idx" ON "copywriting" USING btree ("product_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "copywriting_collection_id_idx" ON "copywriting" USING btree ("collection_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "creative_briefs_collection_id_idx" ON "creative_briefs" USING btree ("collection_id");
--> statement-breakpoint

-- Creator Registry (global table)
CREATE TABLE IF NOT EXISTS "creator_registry" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "brand_id" uuid,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "created_by" text,
  "updated_by" text,
  "deleted_at" timestamptz,
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
  "normalized_instagram" text UNIQUE,
  "legacy_airtable_id" text
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "creator_registry_name_idx" ON "creator_registry" USING btree ("name");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "creator_registry_instagram_idx" ON "creator_registry" USING btree ("instagram_username");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "creator_registry_normalized_ig_idx" ON "creator_registry" USING btree ("normalized_instagram");
--> statement-breakpoint

-- Creator Registry FK on creators
ALTER TABLE "creators" ADD COLUMN "registry_creator_id" uuid REFERENCES "creator_registry"("id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "creators_registry_creator_id_idx" ON "creators" USING btree ("registry_creator_id");
--> statement-breakpoint

-- Client Access Tokens
CREATE TABLE IF NOT EXISTS "client_access_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "brand_id" uuid NOT NULL REFERENCES "brands"("id"),
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "created_by" text,
  "updated_by" text,
  "deleted_at" timestamptz,
  "token" text NOT NULL UNIQUE,
  "email" text NOT NULL,
  "label" text,
  "expires_at" timestamptz,
  "last_used_at" timestamptz,
  "revoked" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "client_access_tokens_brand_id_idx" ON "client_access_tokens" USING btree ("brand_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "client_access_tokens_token_idx" ON "client_access_tokens" USING btree ("token");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "client_access_tokens_email_idx" ON "client_access_tokens" USING btree ("email");
