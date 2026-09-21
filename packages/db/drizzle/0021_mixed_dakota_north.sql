CREATE TABLE "creator_concepts" (
	"creator_id" uuid NOT NULL,
	"concept_id" uuid NOT NULL,
	CONSTRAINT "creator_concepts_creator_id_concept_id_pk" PRIMARY KEY("creator_id","concept_id")
);
--> statement-breakpoint
CREATE TABLE "creator_products" (
	"creator_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	CONSTRAINT "creator_products_creator_id_product_id_pk" PRIMARY KEY("creator_id","product_id")
);
--> statement-breakpoint
ALTER TABLE "creator_concepts" ADD CONSTRAINT "creator_concepts_creator_id_creators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_concepts" ADD CONSTRAINT "creator_concepts_concept_id_concepts_id_fk" FOREIGN KEY ("concept_id") REFERENCES "public"."concepts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_products" ADD CONSTRAINT "creator_products_creator_id_creators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_products" ADD CONSTRAINT "creator_products_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;