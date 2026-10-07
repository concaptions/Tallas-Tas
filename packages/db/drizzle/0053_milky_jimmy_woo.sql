CREATE TABLE "client_access_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_by" text,
	"deleted_at" timestamp with time zone,
	"token" text NOT NULL,
	"email" text NOT NULL,
	"label" text,
	"expires_at" timestamp with time zone,
	"last_used_at" timestamp with time zone,
	"revoked" boolean DEFAULT false NOT NULL,
	CONSTRAINT "client_access_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "client_access_tokens" ADD CONSTRAINT "client_access_tokens_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "client_access_tokens_brand_id_idx" ON "client_access_tokens" USING btree ("brand_id");--> statement-breakpoint
CREATE INDEX "client_access_tokens_token_idx" ON "client_access_tokens" USING btree ("token");--> statement-breakpoint
CREATE INDEX "client_access_tokens_email_idx" ON "client_access_tokens" USING btree ("email");--> statement-breakpoint
CREATE INDEX "creative_briefs_collection_id_idx" ON "creative_briefs" USING btree ("collection_id");--> statement-breakpoint
CREATE INDEX "copywriting_product_id_idx" ON "copywriting" USING btree ("product_id");