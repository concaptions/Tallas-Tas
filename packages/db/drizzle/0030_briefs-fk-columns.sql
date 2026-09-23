ALTER TABLE "creative_briefs" ADD COLUMN "collection_id" uuid;
--> statement-breakpoint
ALTER TABLE "creative_briefs" ADD COLUMN "campaign_offer_id" uuid;
--> statement-breakpoint
ALTER TABLE "creative_briefs" ADD COLUMN "asset_id" uuid;
--> statement-breakpoint
ALTER TABLE "creative_briefs" ADD CONSTRAINT "creative_briefs_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "creative_briefs" ADD CONSTRAINT "creative_briefs_campaign_offer_id_campaigns_offers_id_fk" FOREIGN KEY ("campaign_offer_id") REFERENCES "public"."campaigns_offers"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "creative_briefs" ADD CONSTRAINT "creative_briefs_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;
