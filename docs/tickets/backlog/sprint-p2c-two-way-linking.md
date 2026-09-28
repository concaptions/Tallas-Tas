# P2C — Two-way linking + concept auto-fill (verify + close gaps)

**Role**: backend + frontend · **PRD**: §5.x links · **Est**: M · **Blockers**: none

> Spec says most of this is "already working, verify." The P1 audit confirmed the junction
> tables / reverse FKs exist; this ticket proves each pair works both directions with a test.

## Current state
`junction-tables.ts` defines: angle_products, angle_personas, concept_angles,
concept_themes, concept_collections, creator_concepts, creator_products. Reverse FKs:
`collections.angle_id`, `collections.campaign_id`, `briefs.angle_id`, `briefs.concept_id`,
`briefs.campaign_offer_id`. `junction-queries.ts` holds the sync/load helpers.

## Acceptance criteria — each pair proven bidirectional with a test
- [ ] Products ↔ Angles
- [ ] Personas ↔ Angles
- [ ] Angles ↔ Concepts
- [ ] Concepts ↔ Creative Briefs (concept required on brief; brief shows on concept)
- [ ] UGC Creators ↔ Concepts (link from either side)
- [ ] Themes ↔ Concepts
- [ ] Concept auto-fill from linked Angle: Product, Personas, Pain Points, USP, Type — auto-populate on the concept (verify the read-side derivation; these are lookups, not stored)
- [ ] Any pair found one-directional gets a junction/back-read added (schema sub-ticket) and a test

## Notes
Auto-fill fields are lookups (derived) per the P1 audit — verify the query layer surfaces
them on the concept, don't store duplicates.
