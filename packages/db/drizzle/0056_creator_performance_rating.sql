ALTER TABLE "creators" ADD COLUMN "performance_rating" integer;--> statement-breakpoint
ALTER TABLE "creators" ADD COLUMN "performance_note" text;--> statement-breakpoint
ALTER TABLE "creators" ADD COLUMN "performance_rated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "creators" ADD COLUMN "performance_rated_by" text;--> statement-breakpoint
ALTER TABLE "creators" ADD CONSTRAINT "creators_performance_rating_range" CHECK ("performance_rating" is null or "performance_rating" between 1 and 5);--> statement-breakpoint
CREATE OR REPLACE FUNCTION recompute_registry_avg_rating(p_registry_id uuid) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  IF p_registry_id IS NULL THEN
    RETURN;
  END IF;
  UPDATE "creator_registry"
  SET "avg_rating" = (
    SELECT round(avg("performance_rating"))::integer
    FROM "creators"
    WHERE "registry_creator_id" = p_registry_id
      AND "deleted_at" IS NULL
      AND "performance_rating" IS NOT NULL
  )
  WHERE "id" = p_registry_id;
END
$$;--> statement-breakpoint
CREATE OR REPLACE FUNCTION creators_recompute_registry_avg_rating() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    PERFORM recompute_registry_avg_rating(OLD."registry_creator_id");
  END IF;
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW."registry_creator_id" IS DISTINCT FROM OLD."registry_creator_id") THEN
    PERFORM recompute_registry_avg_rating(NEW."registry_creator_id");
  END IF;
  RETURN NULL;
END
$$;--> statement-breakpoint
DROP TRIGGER IF EXISTS "creators_registry_avg_rating" ON "creators";--> statement-breakpoint
CREATE TRIGGER "creators_registry_avg_rating"
AFTER INSERT OR UPDATE OF "performance_rating", "registry_creator_id", "deleted_at" OR DELETE ON "creators"
FOR EACH ROW EXECUTE FUNCTION creators_recompute_registry_avg_rating();
