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
      inline required messages come from `@tas/domain/concepts` and nowhere else.

      **SUPERSEDED 2026-10-02 (action items AI-36 / AI-37).** This line used to read "the form's
      inline 'Batch is required' / 'Angle is required' / 'Theme is required' messages are
      unchanged". Those three strings were a `REQUIRED_MESSAGES` map local to
      `concept-detail.tsx`, i.e. a second copy of a rule the domain already owned. AI-37 required
      the form to stop re-declaring which fields are required, so the local map was deleted and the
      form now renders `validateConceptDraft`'s own wording — 'Pick the batch this concept belongs
      to.', 'Pick at least one angle this concept is built on.', 'Pick at least one theme this
      angle is paired with.' — plus `NO_ANGLE_LINKED` ('No angle linked yet — at least one is
      required.') as the Angle picker's empty state, which the old 'Angle is required' label
      replaced. No test asserted the old strings, so nothing broke; the criterion itself was the
      stale record. What is still enforced, and is what this line now claims, is that the form
      holds no wording of its own for a required field.
- [x] Production Status hidden (grid in GRID-05, form keeps the hidden round-trip input), logged in
      `docs/decisions.md`.
- [x] LinkField renders on `/design-system`.
- [x] `pnpm typecheck`, `pnpm lint`, `pnpm test`; Playwright for angles, concepts, personas,
      products, ugc and the parity spec pass.

## Handed off — outside this ticket's file set (2026-10-02)

Two things this change makes possible but is not allowed to land, because the file belongs to
another agent's area. Both are one small edit each and neither has a product question in it.

- **AI-35, the Angle column on the Concepts grid.**
  `apps/web/src/app/app/concepts/concepts-workspace.tsx:152-154` (area A) still reads
  `sortValue: (item) => item.angleName` / `render: (item) => item.angleName ?? EM_DASH`, so a
  Gratsi concept linked to several angles shows one angle in the list and no sign the others
  exist. The data it needs is now there and typed: `ConceptItem.angleLinks`
  (`apps/web/src/app/app/concepts/fields.ts:198`, `readonly ConceptAngleItem[]` of `{ id, name }`),
  filled by `page.tsx:60` from `ConceptListRow.angleLinks` (`packages/db/src/concepts.ts:105`,
  PGlite-tested for the multi-angle and the unreadable-link cases). Nothing renders it yet — the
  only reader is `matchesQuery` (`fields.ts:328`), so search already finds a concept by any of its
  angles while the cell shows one. The column should render `angleLinks` as the linked-record list
  the other link columns use, keeping `angleName` as the sort value (it is the §7 naming angle, so
  it is the stable one to order by).
- **UI governance rule 4 for `FieldRequirement`.** The marker
  (`apps/web/src/app/app/concepts/[conceptId]/concept-detail.tsx`, exported, unit tested in
  `concept-detail.test.tsx`) is a new presentational primitive and is not mounted on
  `/design-system`. `apps/web/src/app/(dev)/design-system/concepts.stories.tsx` mounts
  `ConceptBoard`, the view toggle and `NamePreview` and needs one more story showing both states
  (`required` and not). It is exported precisely so the story imports this component rather than a
  copy of it; the marker is meant to spread to every other form, which is the argument for it
  eventually moving to `packages/ui` beside `StatusChip`.

## Pending human verification

- Live mode: link a creator from a concept, open the creator's panel and see the concept; unlink
  from the creator's side and see it leave the concept, against Neon.
