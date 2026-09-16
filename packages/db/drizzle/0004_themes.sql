CREATE TYPE "public"."theme_category" AS ENUM('Framework', 'Production Style', 'Seasonal');--> statement-breakpoint
--> Added in three statements, not as one `ADD COLUMN ... NOT NULL`: PRD §5.5 makes the category a
--> required property of a theme, and a bare NOT NULL add is rejected by Postgres on any database
--> that already holds themes. The column arrives nullable, every existing row is given its category
--> by name (the only rows that can exist are the two seeded fixtures, Problem/Solution and Green
--> Screen; anything else a hand-written theme left behind is a framework, the PRD's first kind),
--> and then the column is made NOT NULL. No default: a category is chosen in the create dialog,
--> never inherited, so a later insert that forgets it must fail loudly.
ALTER TABLE "themes" ADD COLUMN "category" "theme_category";--> statement-breakpoint
UPDATE "themes" SET "category" = (case when "name" = 'Green Screen' then 'Production Style' else 'Framework' end)::"public"."theme_category" WHERE "category" IS NULL;--> statement-breakpoint
ALTER TABLE "themes" ALTER COLUMN "category" SET NOT NULL;
