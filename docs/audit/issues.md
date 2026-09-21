# Platform Audit — Issue Log

Audit date: 2026-09-21
Auditor: Claude (automated)
Environment: Demo mode (port 3001, empty Clerk keys, fixture data)

## Issues Found

### ISSUE-001 — Overview library cards not linked (severity: medium)

**File:** `apps/web/src/app/app/page.tsx`
**Symptom:** Angles, Themes, and Concepts cards in the Library section showed "Section not available yet" instead of navigating to their pages.
**Root cause:** Card objects lacked `href` properties.
**Fix:** Added `href` pointing to `anglesPath`, `themesPath`, and `conceptsPath` from `@/lib/routes`.
**Status:** Fixed and verified.

### ISSUE-002 — Asset Library cards not clickable (severity: medium)

**File:** `apps/web/src/app/app/assets/asset-grid.tsx`
**Symptom:** Asset cards were plain `<div>` elements — no click behaviour despite a detail page at `/app/assets/[assetId]`.
**Root cause:** Card wrapper was a `<div>`, not a `<Link>`.
**Fix:** Wrapped each card in `<Link href={assetPath(asset.id)}>` with hover transition.
**Status:** Fixed and verified.

### ISSUE-003 — Performance Tracker rows not clickable (severity: medium)

**File:** `apps/web/src/app/app/performance/performance-tracker.tsx`
**Symptom:** Table rows were not interactive despite a detail page at `/app/performance/[metricId]`.
**Root cause:** `<tr>` elements had no click handler or navigation.
**Fix:** Added `role="button"`, `tabIndex={0}`, `onClick`, `onKeyDown` (Enter/Space) using `useRouter().push(adMetricPath(metric.id))`. Added `cursor-pointer` and `hover:bg-surface2`.
**Status:** Fixed and verified.

### ISSUE-004 — Ad Spy cards not clickable (severity: medium)

**File:** `apps/web/src/app/app/ad-spy/ad-spy-board.tsx`
**Symptom:** Competitor ad cards were plain `<div>` elements — no click behaviour despite a detail page at `/app/ad-spy/[adId]`.
**Root cause:** Card wrapper was a `<div>`, not a `<Link>`.
**Fix:** Wrapped each card in `<Link href={competitorAdPath(ad.id)}>` with hover transition.
**Status:** Fixed and verified.

### ISSUE-005 — Creator Ranking rows not clickable (severity: medium)

**File:** `apps/web/src/app/app/creator-ranking/creator-leaderboard.tsx`
**Symptom:** Table rows were not interactive despite a detail page at `/app/creator-ranking/[rankingId]`.
**Root cause:** `<tr>` elements had no click handler or navigation.
**Fix:** Added `role="button"`, `tabIndex={0}`, `onClick`, `onKeyDown` (Enter/Space) using `useRouter().push(creatorRankingDetailPath(ranking.id))`. Added `cursor-pointer` and `hover:bg-surface2`.
**Status:** Fixed and verified.

## Not-a-bug (investigated, no fix needed)

- **Theme cards not clickable:** By design. The `actions.ts` for themes only has `createThemeAction`; editing/deleting themes is explicitly out of scope.
- **Personas/Angles/Copywriting/UGC:** Already use side panel pattern with `?param=` URL param — working correctly.
- **Concepts/Briefs/Upload-links:** Already use `[id]/page.tsx` detail routes — working correctly.
- **Client portal:** Approve/Request Revisions buttons work; Kanban board navigates to brief details.
- **Internal queue:** Kanban cards link to brief detail pages — working correctly.
- **Config pages (Team, Interface, Notifications, Propagation, Onboard):** All functional, forms save correctly in demo mode.

## Summary

| Metric | Value |
|--------|-------|
| Routes audited | 23+ |
| Issues found | 5 |
| Issues fixed | 5 |
| Issues remaining | 0 |
| False positives | 1 (themes by design) |
