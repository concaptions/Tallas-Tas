CREATE TABLE "annotations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_by" text,
	"deleted_at" timestamp with time zone,
	"record_type" text NOT NULL,
	"record_id" uuid NOT NULL,
	"author_id" text NOT NULL,
	"author_name" text NOT NULL,
	"kind" text NOT NULL,
	"timestamp_seconds" real,
	"x" real,
	"y" real,
	"body" text NOT NULL,
	CONSTRAINT "annotations_video_timestamp_check" CHECK ("annotations"."kind" != 'video_timestamp' OR "annotations"."timestamp_seconds" IS NOT NULL),
	CONSTRAINT "annotations_image_xy_check" CHECK ("annotations"."kind" != 'image_xy' OR ("annotations"."x" IS NOT NULL AND "annotations"."y" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_by" text,
	"deleted_at" timestamp with time zone,
	"record_type" text NOT NULL,
	"record_id" uuid NOT NULL,
	"parent_comment_id" uuid,
	"author_id" text NOT NULL,
	"author_name" text NOT NULL,
	"body" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "annotations" ADD CONSTRAINT "annotations_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_parent_comment_id_comments_id_fk" FOREIGN KEY ("parent_comment_id") REFERENCES "public"."comments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "annotations_brand_record_idx" ON "annotations" USING btree ("brand_id","record_type","record_id");--> statement-breakpoint
CREATE INDEX "comments_brand_record_idx" ON "comments" USING btree ("brand_id","record_type","record_id");--> statement-breakpoint
CREATE INDEX "comments_parent_comment_id_idx" ON "comments" USING btree ("parent_comment_id");