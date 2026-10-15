-- 0072: Phase B5 — per-user ordering of group values on a grouped table view.
-- One row stores the manual order of the groups a user has arranged for a specific
-- (brand, table, grouping field) scope, either globally for that scope or inside a
-- saved view. `order_json` is the array of group keys in display order.
--
-- Why two partial unique indexes instead of a single UNIQUE constraint:
--   A plain UNIQUE (user_id, brand_id, view_id, table_key, field_key) with a nullable
--   view_id does NOT enforce uniqueness across NULLs in Postgres (NULL ≠ NULL for
--   uniqueness). The two partial indexes together enforce "one row per
--   (user, brand, table, field) when view_id IS NULL" AND "one row per
--   (user, brand, view, table, field) when view_id IS NOT NULL".
--
-- FK target notes:
--   * `view_id` references `user_table_views` (the real table name; the spec referred
--     to it loosely as `user_views`).
--   * All FKs cascade on delete so a removed user, brand, or view takes its orderings
--     with it.
CREATE TABLE "user_group_orders" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "user_id" uuid NOT NULL,
    "brand_id" uuid NOT NULL,
    "view_id" uuid,
    "table_key" text NOT NULL,
    "field_key" text NOT NULL,
    "order_json" jsonb NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "user_group_orders_user_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
    CONSTRAINT "user_group_orders_brand_fk" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE CASCADE,
    CONSTRAINT "user_group_orders_view_fk" FOREIGN KEY ("view_id") REFERENCES "user_table_views"("id") ON DELETE CASCADE
);
--> statement-breakpoint
CREATE UNIQUE INDEX "user_group_orders_scope_unique_null_view" ON "user_group_orders" ("user_id", "brand_id", "table_key", "field_key") WHERE "view_id" IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX "user_group_orders_scope_unique_with_view" ON "user_group_orders" ("user_id", "brand_id", "view_id", "table_key", "field_key") WHERE "view_id" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX "user_group_orders_lookup_idx" ON "user_group_orders" ("user_id", "brand_id", "table_key", "field_key");
