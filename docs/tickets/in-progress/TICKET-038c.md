# TICKET-038c: Frontend — Client Portal & Annotation UI (PRD §10)

Sprint 6 · Agent 3 (frontend) · ~6h estimate · Depends on: 038a, 038b · Blocks: 038d

## Why

The client portal is a structurally separate interface from `/app`. Talal was explicit: not shared
components with conditional field hiding, but its own layout tree with its own nav, its own shell,
and pages that import exclusively from the client-scoped query layer.

## PRD sections

§10 (Client interface), §11 (Roles — client sees only their brand)

## Structural rule

**No `/client` page may import any query, source, or action from `/app/app/`.**
Client pages use `packages/db/src/client-queries.ts` (038b) and client-specific actions only.
This is enforced by the test in 038d and by code review.

## Acceptance criteria

### Client layout & shell

1. `/client/layout.tsx` — full client shell, NOT the existing minimal wrapper:
   - Client-branded top bar with brand name (from their `brand_assignments` row)
   - Navigation for the 6 client pages, filtered by interface config (disabled pages hidden)
   - No sidebar matching `/app` — simpler nav appropriate for a client (horizontal tabs or compact sidebar)
   - No admin controls, no brand switcher (client sees one brand only)
   - Demo mode banner when no Clerk keys

2. Client nav reads `enabledPages()` from interface config to determine which tabs to show.

### 6 client pages

3. **`/client/concepts/page.tsx`** — Concepts pending client review
   - Grid of concept cards showing only allowlisted fields
   - Each card has Approve / Request Revisions buttons
   - Fields rendered per interface config `visibleFields()`
   - Comments section per concept (threaded, via `CommentThread` component)

4. **`/client/creatives/page.tsx`** — Approved creatives for client review
   - Cards showing design files as images/thumbnails, creative name, type, status
   - Approve / Request Revisions buttons
   - **Annotation UI** for each creative:
     - If `design_file` contains images: click on image to pin an xy annotation (normalised coords)
     - If creative is video type: video player with seek bar + click to pin timestamp annotation
     - Annotation markers displayed on image/video with author name and body text
     - Side panel or overlay listing all annotations for this creative
   - Comments section (threaded)

5. **`/client/copywriting/page.tsx`** — Copywriting pending client review
   - List/cards showing primary copy, headline, CTA, funnel
   - Status chip + Client's Comment field (editable)
   - Approve / Request Revisions buttons

6. **`/client/ugc/page.tsx`** — UGC creators assigned to this brand
   - Creator cards: name, profile pic, age bracket, status
   - Editable fields: tracking number, client note, client status
   - No cost/platform/internal fields visible

7. **`/client/partnership/page.tsx`** — Partnership ads tracking (read-only)
   - Table: creator name, Instagram username, activity status, expires on (computed)
   - No editable fields, no prices, no partnership notes
   - Grouping and filtering by activity status

8. **`/client/calendar/page.tsx`** — Promotional Calendar (NEW, read-only)
   - Timeline or calendar view of campaigns
   - Shows campaign name, holiday, date range (ads_launch → ads_end)
   - No discount codes, no financial details
   - Reuse `TimelineView` component from Sprint 5 if appropriate

### Annotation components

9. **`ImageAnnotator`** component in `packages/ui/src/annotations/`:
   - Renders an image with clickable overlay
   - Click places a pin at normalised (x, y) coordinates
   - Existing pins shown as numbered markers with author/body on hover
   - New pin opens a form to type annotation body + submit

10. **`VideoAnnotator`** component:
    - Video player with standard controls (play/pause/seek)
    - "Pin at timestamp" button captures current playback position
    - Timestamp pins shown as markers on the seek bar
    - Click a marker to jump to that timestamp and show the annotation
    - New pin opens a form to type annotation body + submit

11. Both components display existing annotations in a list alongside the media,
    sorted by timestamp/position.

### Comment thread component

12. **`CommentThread`** component in `packages/ui/src/comments/`:
    - Renders top-level comments with nested replies (max depth 2)
    - Reply button on each top-level comment
    - New comment form at the bottom
    - Author name + relative time on each comment
    - Uses `createCommentAction` from 038b

13. `CommentThread` is reusable — takes `recordType` and `recordId` props, used on all 6 pages
    where comments apply (concepts, creatives, copywriting; UGC/partnership/calendar are view-only
    or have their own note fields).

### Interface Config admin page update

14. Update `/app/interface-config` to show the 6th page (calendar) in the config tree.
    The existing tree + preview pattern extends naturally.

### Approve / Request Revisions

15. Both buttons on every reviewable record (concepts, creatives, copywriting, UGC creators).
    Wire to `approveRecordAction` / `requestRevisionsAction` from 038b.
    Buttons disabled when transition is not allowed (via `canTransitionClient()`).

16. After approval/revision, the card updates optimistically and the page revalidates.

### Demo mode

17. All 6 pages work in demo mode with fixture data from `@tas/db`.
    Annotation and comment fixtures from 038b render correctly.
    Write actions show `DisabledWrite` tooltip in demo mode.

## Out of scope

- Clerk sign-in flow for clients (gated on real credentials)
- Email/Slack notifications on client actions (Sprint 7)
- Real video playback for annotations (use placeholder video in demo; real video URLs in production)
