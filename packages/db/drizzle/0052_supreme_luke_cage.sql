ALTER TABLE "copywriting" ADD COLUMN "collection_id" uuid;--> statement-breakpoint
ALTER TABLE "copywriting" ADD CONSTRAINT "copywriting_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "copywriting_collection_id_idx" ON "copywriting" USING btree ("collection_id");--> statement-breakpoint
ALTER TABLE "copywriting" ADD COLUMN "client_approval_status" text;--> statement-breakpoint
ALTER TABLE "copywriting" ADD COLUMN "client_approval_note" text;--> statement-breakpoint
ALTER TABLE "copywriting" ADD COLUMN "client_approval_status_updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "creative_sheet_items" ADD COLUMN "client_approval_status" text;--> statement-breakpoint
ALTER TABLE "creative_sheet_items" ADD COLUMN "client_approval_note" text;--> statement-breakpoint
ALTER TABLE "creative_sheet_items" ADD COLUMN "client_approval_status_updated_at" timestamp with time zone;
