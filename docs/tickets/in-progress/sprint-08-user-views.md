# Sprint 8 — Gallery, per-user views, Fields toggle, UGC media (VIEWS-01 … VIEWS-04)

**PRD sections**: §5.1, §5.2, §5.5, §5.6, §5.7, §5.8 (the six core tables); §5.8 UGC media.
Builds on Sprint 7 (`sprint-07-airtable-grid.md`).

| Ticket   | Scope |
| -------- | ----- |
| VIEWS-01 | Per-user saved views: `user_table_views` (migration 0040), `@tas/domain/views/user-views`, Server Actions, `useTableView`, Views menu, Fields popover, view-controlled `AirtableGrid` |
| VIEWS-02 | Gallery as the second view on all six tables; card image = profile pic (UGC) / first attachment (Themes) / coloured initial tile (others); the Fields popover hides card lines too |
| VIEWS-03 | UGC grid: avatar inside the frozen name cell (landed with GRID-06) |
| VIEWS-04 | UGC detail: several showcase videos per creator with inline playback, on the existing `assets` + R2 storage (`assets.creator_id`, migration 0041) |

## Acceptance criteria

- [x] Gallery is offered on Products, Personas, Angles, Themes, Concepts and UGC
      (`TABLE_VIEW_CAPABILITIES`), and each page renders it from the same column definitions as
      its grid (`galleryItemsFrom`).
- [x] A user can create, rename, delete and switch their own views per table; a view stores view
      type, visible fields, field order, frozen columns, sort and filter; it is keyed on the Clerk
      user id + table key and never listed, read or written for another user (PGlite test).
- [x] The Fields popover on Grid and Gallery persists into the active view; with no active view it
      first creates "My view" for the user.
- [x] In demo mode (no Clerk) the same state lives in the visitor's own browser storage.
- [x] UGC creator panel lists showcase videos with inline `<video>` playback and uploads a new one
      through `uploadToR2` + `insertAsset` (category `showcase_video`, `creator_id` set).
- [x] Migration SQL shown, not applied to production (`0040_user-table-views.sql`,
      `0041_creator-showcase-videos.sql`).
- [x] Every new control renders on `/design-system`.
- [x] Playwright `user-views.spec.ts`: on each table, Gallery → Grid → hide a field → reload →
      still hidden; a second browser context (second user) still sees it.
- [x] `pnpm typecheck`, `pnpm lint`, `pnpm test` pass.

## Pending human verification

- Live mode: create / rename / delete a view as two different Clerk users on Neon and confirm
  neither sees the other's; the Fields toggle survives a sign-out / sign-in.
- Live mode: upload a showcase video with R2 credentials configured and play it back.
- Production: apply migrations 0040 and 0041 with `pnpm --filter @tas/db migrate-prod`.
