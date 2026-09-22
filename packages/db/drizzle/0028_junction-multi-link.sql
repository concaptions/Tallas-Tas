-- Migration 0028: Convert single-FK columns to proper junction tables
-- for Airtable multi-link parity (concepts-angles, concepts-themes,
-- angles-personas, angles-products, concepts-creators via existing creatorConcepts).

-- 1. Create the four new junction tables

CREATE TABLE IF NOT EXISTS "concept_angles" (
  "concept_id" uuid NOT NULL REFERENCES "concepts"("id") ON DELETE CASCADE,
  "angle_id"   uuid NOT NULL REFERENCES "angles"("id")   ON DELETE CASCADE,
  CONSTRAINT "concept_angles_pkey" PRIMARY KEY ("concept_id", "angle_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "concept_themes" (
  "concept_id" uuid NOT NULL REFERENCES "concepts"("id") ON DELETE CASCADE,
  "theme_id"   uuid NOT NULL REFERENCES "themes"("id")   ON DELETE CASCADE,
  CONSTRAINT "concept_themes_pkey" PRIMARY KEY ("concept_id", "theme_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "angle_personas" (
  "angle_id"   uuid NOT NULL REFERENCES "angles"("id")   ON DELETE CASCADE,
  "persona_id" uuid NOT NULL REFERENCES "personas"("id") ON DELETE CASCADE,
  CONSTRAINT "angle_personas_pkey" PRIMARY KEY ("angle_id", "persona_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "angle_products" (
  "angle_id"   uuid NOT NULL REFERENCES "angles"("id")   ON DELETE CASCADE,
  "product_id" uuid NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
  CONSTRAINT "angle_products_pkey" PRIMARY KEY ("angle_id", "product_id")
);
--> statement-breakpoint
-- 2. Migrate existing FK data into junction tables

INSERT INTO "concept_angles" ("concept_id", "angle_id")
SELECT "id", "angle_id" FROM "concepts" WHERE "angle_id" IS NOT NULL
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "concept_themes" ("concept_id", "theme_id")
SELECT "id", "theme_id" FROM "concepts" WHERE "theme_id" IS NOT NULL
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "angle_personas" ("angle_id", "persona_id")
SELECT "id", "persona_id" FROM "angles" WHERE "persona_id" IS NOT NULL
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "angle_products" ("angle_id", "product_id")
SELECT "id", "product_id" FROM "angles" WHERE "product_id" IS NOT NULL
ON CONFLICT DO NOTHING;
--> statement-breakpoint
-- Migrate concepts.creator_id into the existing creator_concepts junction
INSERT INTO "creator_concepts" ("creator_id", "concept_id")
SELECT "creator_id", "id" FROM "concepts" WHERE "creator_id" IS NOT NULL
ON CONFLICT DO NOTHING;
--> statement-breakpoint
-- 3. Drop old FK columns and their indexes

DROP INDEX IF EXISTS "concepts_angle_id_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "concepts_theme_id_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "angles_persona_id_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "angles_product_id_idx";
--> statement-breakpoint
ALTER TABLE "concepts" DROP COLUMN IF EXISTS "angle_id";
--> statement-breakpoint
ALTER TABLE "concepts" DROP COLUMN IF EXISTS "theme_id";
--> statement-breakpoint
ALTER TABLE "concepts" DROP COLUMN IF EXISTS "creator_id";
--> statement-breakpoint
ALTER TABLE "angles" DROP COLUMN IF EXISTS "persona_id";
--> statement-breakpoint
ALTER TABLE "angles" DROP COLUMN IF EXISTS "product_id";
