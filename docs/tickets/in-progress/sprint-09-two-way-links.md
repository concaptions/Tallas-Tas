# Sprint 9 — Two-way linking and Concept form rules (LINK-01 … LINK-03)

**PRD sections**: §5.6 (Angles ↔ Personas/Products), §5.7 (Concepts: pairing, inheritance,
naming — §7), §5.8 (UGC creators ↔ Concepts).

| Ticket  | Scope |
| ------- | ----- |
| LINK-01 | One `LinkField` on both sides of every link, one junction per link: Concept ↔ Creator (`creator_concepts`), Angle ↔ Concept (`concept_angles`), Product ↔ Angle (`angle_products`), Persona ↔ Angle (`angle_personas`). Registry in `@tas/domain/links`, junction sync in `@tas/db` (`syncLinks`), one Server Action (`setLinksAction`) |
| LINK-02 | Inheritance: a concept shows EVERY persona and product of its angle as read-only lookups (`inheritedFromAngle`), never stored |
| LINK-03 | Concept form: Batch / Angle / Theme required with inline errors; name derives as Batch-Angle-Theme and follows every change; Production Status hidden from form, grid and panel (column kept); "Brief" section renamed "Concept details" |

## Acceptance criteria

- [x] A link made from either side is read from the other after one write (PGlite test
      `packages/db/src/links.test.ts`, every junction both ways).
- [x] The same component (`apps/web/src/components/links/link-field.tsx`) is mounted on: Concept
      detail (angles, creators), Creator panel (concepts), Angle panel (personas, products,
      concepts), Product panel (angles), Persona panel (angles).
- [x] A saved record's LinkField writes the junction on every change and refreshes; a new record's
      LinkField posts hidden inputs that the create action syncs after insert.
- [x] The Server Action proves the source record is in the actor's brand before writing.
- [x] Inherited Persona / Product rows on the concept list every linked name (domain test).
- [x] Required-field blocking and name derivation pinned (`concept-rules.test.ts`); the form's
      inline "Batch is required" / "Angle is required" / "Theme is required" messages are unchanged.
- [x] Production Status hidden (grid in GRID-05, form keeps the hidden round-trip input), logged in
      `docs/decisions.md`.
- [x] LinkField renders on `/design-system`.
- [x] `pnpm typecheck`, `pnpm lint`, `pnpm test`; Playwright for angles, concepts, personas,
      products, ugc and the parity spec pass.

## Pending human verification

- Live mode: link a creator from a concept, open the creator's panel and see the concept; unlink
  from the creator's side and see it leave the concept, against Neon.
