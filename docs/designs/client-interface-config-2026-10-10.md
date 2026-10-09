# Client interface config — design note (Talal Oct 7, item 6)

**Status: DESIGN, awaiting a scope decision. No code.** Sources: `docs/PRD.md` §10 (five client pages,
configurable per client at two levels), §5.8.1 (Partnership Ads Tracking), §9; CLAUDE.md non-negotiables
1, 2, 10; `docs/design/template-engine.md`; production state read on 2026-10-10 (read-only).

## 1. What exists today, end to end

**Tables (all shipped, all in production).**

| Table | Scope | What it holds | Override model |
| --- | --- | --- | --- |
| `interface_pages` / `interface_fields` (0010) | per brand, `brand_id` NOT NULL | PRD §10: the six page keys (`concepts, creatives, copywriting, ugc, partnership, calendar`), `enabled` + `position`; per field `visible` + `client_editable` | Seeded **per brand at onboarding** from `DEFAULT_INTERFACE_PAGES` (`@tas/domain/interface`). The template has **0** rows; Niagara 5, `test` 6, **Gratsi 0**. Nothing inherits — each brand owns its copy. |
| `interface_tab_visibility` (0051) | per brand, NOT NULL | The FOUR portal tabs (`concepts, creative_sheet, ugc_management, copywriting`): `is_visible`, `sort_order` | Template rows are the default (4 rows); a child row with the same `tab_key` overrides; `resetTabVisibilityAction` hard-deletes the override. `mergeTabVisibility` resolves at read time. |
| `custom_interface_pages` (0051) | `brand_id` NULLABLE | Admin-defined pages: `slug, title, source_table_key, filter_config, column_config, sort_order, is_visible, is_inherited` | `brand_id IS NULL` = template page every child sees; a child row with the same slug overrides; `is_inherited=false` = detached, propagation skips it. `mergeCustomPages` at read time. |
| `column_definitions` (0044–0046) | template + per brand | The resolver: per table, which columns exist, label, order, `hidden`, `is_detached` | Template rows inherited; brand rows override (Gratsi: 238). Decides which columns a custom page may draw. |
| `promotion_requests` (0012) / `propagation_runs` (0034) / `custom_field_schemas` (0019) | agency | Child→template field promotion with Admin review; audit of runs; custom field definitions | `propagation_runs` is **empty** in production: propagation has never run. 3 promotion requests pending. |

**Server actions.** `/app/interface-config`: `saveInterfaceConfigAction` (§10 pages+fields, one draft, Admin
only); `toggleTabVisibilityAction` / `reorderTabAction` / `resetTabVisibilityAction` (Admin+CSM);
`createCustomPageAction` / `updateCustomPageAction` / `deleteCustomPageAction` (Admin+CSM);
`requestCustomPagePromotionAction` — **"Push to all clients", which bypasses review and calls
`propagateCustomInterfacePageToChildren` directly** (documented V0 shortcut). `/app/propagation`:
`approvePromotionAction` / `rejectPromotionAction` (child→template, Admin), `propagateAllAction` (every
template table to every child, Admin, manual), custom-field add/update/delete/promote.

**UI.** `/app/interface-config` = §10 tree + live preview, Tab Visibility section, Custom Pages section
(slug, title, source table, one filter clause, column picks), Token section (magic links). `/app/propagation`
= promotion review + "Propagate all" + custom fields. Client portal `/client/<slug>`: `(portal)/layout.tsx`
merges tab visibility + custom pages into the nav; routes are the four standard tabs, `angles`, `themes`,
`calendar`, and `custom/[pageSlug]`. **There is no `partnership` route** although the §10 key exists.

**How a per-brand override works today.** Tab: write a brand row (toggle/reorder) → merge prefers it;
reset deletes it. Custom page: a child row with the template's slug; the engine updates `is_inherited=true`
rows in place and leaves `is_inherited=false` alone. §10 fields: no override model at all — each brand's
rows are its own. **How admin approval flows.** Field promotions child→template: request → Admin approves →
template row updated → `propagateTemplateRow` to children. Template pages template→children: no review step.

**Findings that shape the design (none fixed in this run).**

- **F1 — non-negotiable 10 breach, live.** The seed created two TEMPLATE custom pages, `internal-queue`
  (filter `internal_status is_not_empty`, `column_config: []`) and `client-queue`, visible on every brand's
  portal. `column_config: []` means *every resolver column* of `creative_briefs`, and `loadCustomPageRows`
  is a plain `select()` with no client allowlist. A client opening `/client/<slug>/custom/internal-queue`
  sees every brief's **internal status**. Cheapest containment is a data change (template row
  `is_visible=false` or soft-delete) — needs your go; the structural fix is in both scopes below.
- **F2** — Gratsi has no §10 `interface_pages` rows (seeded only at onboarding); its portal runs on
  `CLIENT_TAB_KEYS` fallbacks and the resolver hide-list, not on §10 field config.
- **F3** — "Push to all clients" skips the review surface the PRD puts in front of every propagation.

## 2. Scope A — extend the propagation system with a "client page" entity

Treat `custom_interface_pages` as THE client-page entity and give it the same life-cycle every other
propagated row has. Standard tabs, custom filtered views and module pages (Partnership Ads Tracking) become
one kind of thing: a page row.

**Data model (one migration, additive).** On `custom_interface_pages`: `page_kind text NOT NULL DEFAULT
'custom'` (`standard | custom | module`), `module_key text NULL` (e.g. `partnership_ads`), `template_row_id
uuid NULL` (child → template page it inherits from; replaces matching-by-slug), `overridden_fields jsonb
DEFAULT '[]'` (the CLAUDE.md pattern, so a child can keep its own title or filter and still take the
template's column set). Register the table in `PROPAGATION_TABLES`. `interface_tab_visibility` is retired
by migrating its 4 template rows into `page_kind='standard'` rows (one per `CLIENT_TAB_KEYS` key; the
standard tab's route stays its own, the row only carries visibility and order). `interface_pages` /
`interface_fields` stay as the FIELD layer (§10 "which fields appear"); this scope is the PAGE layer.

**Server actions.** Keep the three page CRUD actions. Replace `requestCustomPagePromotionAction` with
`requestPagePushAction` that writes a `promotion_requests` row (`table_name='custom_interface_pages'`,
`row_id=<template page>`, proposed = "push") → Admin approves on `/app/propagation` →
`propagateCustomInterfacePageToChildren` (existing) runs under a `propagation_runs` row. Per-brand toggle
= `setPageVisibilityAction(brandId, pageId, visible)` writing the child row's `is_visible` and marking the
field overridden. `loadCustomPageRows` gains the client column allowlist (fixes F1 structurally: a client
page can only draw columns the resolver marks client-visible, never `internal_*`, costs, prices).

**UI shape.** Interface Config → one "Pages" section listing every page of the brand in order (standard,
custom, module) with visibility switch, drag order, "inherited / overridden" chip, and "Push to all
clients" on template pages (which now opens a review item, not a write). The §10 tree stays for fields.
Propagation page → page pushes appear in the same queue as field promotions.

**Replacing the Internal Queue and Client Queue tabs.** The `/app/queue/*` pages are team-only and stay.
The portal's `client-queue` template page becomes `page_kind='standard'` ("Approvals": creatives with
`client_status = pending_for_approval`) and `internal-queue` is deleted from the template (it was never a
client page). Switch-over rule from your brief: only after the new page layer has run on one brand in
production for a week.

**Gratsi's Partnership Ads Tracking.** A `module` page: `source_table_key='creators'`, `module_key=
'partnership_ads'`, preset filter `for_partnership_ads = true`, `column_config` = the §5.8.1 column set in
order (creator name, IG handle, activity, activation date, period, continue?, extension, price per 30 days,
notes, FB profile), view/group/filter only (no `client_editable`). Lives on the template as a page every
brand can switch on; Gratsi switches it on. The 25-day expiry alert is a notification trigger (§12), not
part of this design.

**Trade-offs.** + One migration, one review path, reuses `promotion_requests`, `propagation_runs`,
`mergeCustomPages`, the resolver and the portal route — roughly three tickets. + Closes F1/F3 by design.
− Pages and fields remain two layers (`custom_interface_pages` vs `interface_fields`), which the §10 UI
must present as one. − `template_row_id` on a table that today matches by slug is a one-time backfill.

## 3. Scope B — a separate interface-config system for tabs/pages

New tables `client_pages` (template + per brand: `kind, key, title, source_table_key, filter_config,
column_config, sort_order, is_visible, template_row_id, overridden_fields`) and `client_page_pushes`
(template page → children, with `status pending|approved|rejected`, reviewer, note). Replace
`interface_tab_visibility` and `custom_interface_pages` entirely and move `interface_pages`' page-level
`enabled/position` into it, leaving `interface_fields` as the only field table. Own actions (`create,
update, setVisible, reorder, requestPush, approvePush, rejectPush`), own Propagation section, own merge.

**Trade-offs.** + One table answers "which pages does this brand see", no slug matching, no legacy
V0 shortcut to carry. − Two migrations (create + move three tables' rows), ~5 tickets, re-implements the
Oct 6/7 sprint, a second approval queue beside `promotion_requests` (or the same engineering to merge
them), and `interface_pages` left half-used. Same client allowlist work as A. Same queue replacement and
same Gratsi recipe, built on the new table.

## 4. Recommendation

**Scope A**, with two conditions written into the first ticket: the review step before any template→child
push (no direct propagate from Interface Config), and the client column allowlist on `loadCustomPageRows`.
Before Tier B starts, decide F1 separately (hide or delete the template `internal-queue` page — a one-line
data change I will not run without your go).

**Open questions for you.** (1) Is `interface_pages`' page-level `enabled` to be read from the new page
rows (one source of truth) or kept in step by the action? (2) Does `calendar` become a standard page row
too (it is an aux route today)? (3) Who may push a template page: Admin only (PRD) or Admin+CSM (today)?
