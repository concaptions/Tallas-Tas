ALTER TABLE "creative_sheet_items" ADD COLUMN "dimensions" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
UPDATE "creative_sheet_items" AS i
SET "dimensions" = b."dimensions"
FROM "creative_briefs" AS b
WHERE i."brief_id" = b."id"
  AND b."brand_id" = i."brand_id"
  AND i."deleted_at" IS NULL
  AND jsonb_array_length(i."dimensions") = 0
  AND jsonb_array_length(b."dimensions") > 0;--> statement-breakpoint
UPDATE "creative_sheet_items" AS i
SET "dimensions" = i."dimensions" || (
  SELECT COALESCE(jsonb_agg(DISTINCT d."name"), '[]'::jsonb)
  FROM "creative_dimensions" AS d
  WHERE d."creative_design_id" = i."brief_id"
    AND d."brand_id" = i."brand_id"
    AND d."deleted_at" IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements_text(i."dimensions") AS existing("value")
      WHERE existing."value" = d."name"
    )
)
WHERE i."brief_id" IS NOT NULL
  AND i."deleted_at" IS NULL
  AND EXISTS (
    SELECT 1
    FROM "creative_dimensions" AS d
    WHERE d."creative_design_id" = i."brief_id"
      AND d."brand_id" = i."brand_id"
      AND d."deleted_at" IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements_text(i."dimensions") AS existing("value")
        WHERE existing."value" = d."name"
      )
  );
