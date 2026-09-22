CREATE TABLE "concept_collections" (
	"concept_id" uuid NOT NULL,
	"collection_id" uuid NOT NULL,
	CONSTRAINT "concept_collections_concept_id_collection_id_pk" PRIMARY KEY("concept_id","collection_id")
);
--> statement-breakpoint
ALTER TABLE "concept_collections" ADD CONSTRAINT "concept_collections_concept_id_concepts_id_fk" FOREIGN KEY ("concept_id") REFERENCES "public"."concepts"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "concept_collections" ADD CONSTRAINT "concept_collections_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;
