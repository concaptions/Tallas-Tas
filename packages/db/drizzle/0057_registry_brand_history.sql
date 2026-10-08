ALTER TABLE "creator_registry" ADD COLUMN "brands" jsonb DEFAULT '[]'::jsonb NOT NULL;
