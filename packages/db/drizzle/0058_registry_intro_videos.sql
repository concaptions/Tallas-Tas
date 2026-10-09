ALTER TABLE "creator_registry" ADD COLUMN "intro_videos" jsonb DEFAULT '[]'::jsonb NOT NULL;
