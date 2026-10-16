# TAS Bold Redesign — design spec (Direction C "Bold")

Source of truth: the artifact at https://claude.ai/artifact/KhcJYJ8qxUj6VGwVn5b68N ("TAS Bold Redesign",
a self-contained HTML mockup read in full on 2026-10-16). This spec is a faithful extraction — every
token, font, component and page in the artifact, mapped against the code that exists on `main` at
`99fb083`. **No branch, dangling commit or remote contains an implementation of this design; it exists
only as the artifact.** This file is the implementation contract.

Design intent, quoted from the artifact's own comment: *"Direction C 'Bold'. Deep indigo navigation
rail, vivid gradient tiles for headline numbers, soft white work surfaces. Light is the default; dark
redefines colour tokens only."*

---

## 1. Tokens

All tokens live on `:root`. Dark mode redefines **values only** (via `@media (prefers-color-scheme:
dark)` guarded by `:root:not([data-theme="light"])`, and again under `:root[data-theme="dark"]`) —
no component selectors change per theme except the four angle-type and five role tone groups listed
in §3.

### 1.1 Color — light (default)

| Token | Value | Role |
|---|---|---|
| `--bg` | `#F2F3FA` | App background |
| `--panel` | `#FFFFFF` | Card surface |
| `--panel-solid` | `#FFFFFF` | Opaque surface (drawer, avatar ring) |
| `--panel-2` | `#F5F5FC` | Inset surface (hover rows, boxes, seg control) |
| `--line` | `#E5E5F2` | Hairline borders |
| `--line-2` | `#D2D2E6` | Stronger borders (inputs, tags) |
| `--ink` | `#15123A` | Primary text |
| `--ink-2` | `#474470` | Secondary text |
| `--ink-3` | `#6A6890` | Tertiary text / labels |
| `--accent` | `#6C3BFF` | Primary accent (purple) |
| `--accent-2` | `#FF4F82` | Secondary accent (pink) — gradients pair accent→accent-2 |
| `--accent-ink` | `#FFFFFF` | Text on accent |
| `--accent-soft` | `#EEE8FF` | Accent wash background |
| `--accent-text` | `#5A27F0` | Accent-tinted text on light surfaces |
| `--ok` / `--ok-soft` | `#0B8452` / `#E1F6EC` | Success tone |
| `--warn` / `--warn-soft` | `#9C5900` / `#FFF1DA` | Warning tone |
| `--bad` / `--bad-soft` | `#CC3049` / `#FFE6EB` | Danger tone |
| `--info` / `--info-soft` | `#2160E6` / `#E3ECFF` | Info tone |
| `--side-bg` | `#17123F` | Sidebar rail (deep indigo) |
| `--side-ink` | `#FFFFFF` | Sidebar primary text |
| `--side-ink-2` | `#BDB8E6` | Sidebar secondary text |
| `--side-active` | `rgba(255,255,255,.1)` | Sidebar hover; **active item is `#fff` bg + `#17123F` text** |
| `--shadow` | `0 1px 2px rgba(21,18,58,.04), 0 14px 32px -18px rgba(21,18,58,.22)` | Card shadow |
| `--chart-1` / `--chart-2` | `#6C3BFF` / `#FF4F82` | Chart series |
| `--grid` | `#ECECF6` | Chart gridlines |
| `--fill-o` | `.2` | Chart area-fill opacity |
| `--scrim` | `rgba(21,18,58,.4)` | Drawer/mobile-nav scrim |

### 1.2 Color — dark

| Token | Value |
|---|---|
| `--bg` | `#0D0B21` |
| `--panel` / `--panel-solid` | `#17143A` |
| `--panel-2` | `#1F1B48` |
| `--line` / `--line-2` | `rgba(255,255,255,.08)` / `rgba(255,255,255,.15)` |
| `--ink` / `--ink-2` / `--ink-3` | `#F2F0FF` / `#BEBAE4` / `#9490C0` |
| `--accent` / `--accent-2` | `#7C55FF` / `#FF6B96` |
| `--accent-soft` / `--accent-text` | `rgba(124,85,255,.2)` / `#B9A3FF` |
| `--ok` / `--warn` / `--bad` / `--info` | `#3EDC95` / `#FFC15C` / `#FF7A93` / `#7FA9FF` |
| `*-soft` tones | same hue at 13% alpha, e.g. `rgba(62,220,149,.13)` |
| `--side-bg` / `--side-ink-2` / `--side-active` | `#08061A` / `#B4AFE0` / `rgba(255,255,255,.09)` |
| `--shadow` | `0 0 0 1px var(--line), 0 18px 36px -20px rgba(0,0,0,.7)` |
| `--chart-1` / `--chart-2` / `--grid` / `--fill-o` | `#8F6BFF` / `#FF6B96` / `rgba(255,255,255,.06)` / `.25` |
| `--scrim` | `rgba(0,0,0,.6)` |

### 1.3 Radius

| Token / usage | Value |
|---|---|
| `--r` (cards, banners, board columns, tablewrap, drop zone) | `20px` |
| Sidebar rail | `24px` |
| Buttons, search, inputs, ibtn, seg container | `14px` |
| Btn.sm, seg buttons, tabs buttons | `11–12px` |
| Poster thumbnails, fb preview, brand button | `14px` |
| Inset boxes (usp, pbox, script, note, diff cells) | `12px` |
| Nav items, batch pill badge, queue rows | `10–14px` |
| Chips, pills, switch, track bars, progress, words | `99px` (full) |
| Mini poster | `8px` |
| Focus ring | `6px` |

### 1.4 Spacing & layout dimensions

| What | Value |
|---|---|
| App grid | `264px minmax(0,1fr)` (portal mode: single column, sidebar hidden) |
| Sidebar | sticky `top:12px`, margin `12px 0 12px 12px`, height `calc(100vh - 24px)`, padding `20px 14px`, internal gap `18px` |
| Top bar | padding `18px 32px 0`, control height `44px` |
| Page | padding `28px 32px 170px`, column gap `22px`, `max-width: 1440px` |
| Card header | `18px 20px 0`; card bodies `14–20px` |
| Grid gaps | KPIs `16px`; most card grids `18px`; posters `16px`; review `20px` |
| h1 | `--h1: 40px` (30px ≤900px), weight 800, `-.03em`, `line-height 1.05`; gradient `<em>` accent-to-pink text |
| Base body | `14px/1.5` |
| Drawer | `min(580px, 100vw)` right-anchored; header/footer padding `18–14px 22px` |
| Persona layout | `320px minmax(0,1fr)` |
| KPI value | `44px/1` weight 700 |
| Breakpoints | `1180px` (grids collapse to 2/1 col), `900px` (sidebar → fixed overlay `min(290px, 86vw)`, h1 30px), `560px` (single column, formula stacks) |
| Motion | drawer `slide .25s cubic-bezier(.2,.8,.2,1)`, fade `.2s`; poster hover `translateY(-3px)` + deepened shadow; `prefers-reduced-motion` kills all |

### 1.5 Shadows (beyond `--shadow`)

- Primary button: `0 10px 24px -12px color-mix(in srgb, var(--accent) 80%, transparent)`
- KPI tiles: per-gradient colored glow, e.g. `0 18px 34px -18px rgba(108,59,255,.8)`
- Logo mark: `0 6px 20px -6px rgba(255,79,130,.7)`
- Drawer: `-30px 0 60px -30px rgba(0,0,0,.45)`
- Toast: `0 18px 40px -16px rgba(0,0,0,.6), 0 0 0 1px rgba(255,255,255,.08)`

## 2. Typography

Google Fonts load: `Outfit:wght@400;500;600;700;800`, `DM+Mono:wght@400;500`, `Figtree:wght@500;600`.

| Token | Stack | Used for |
|---|---|---|
| `--font-d` | `"Outfit", "Segoe UI", system-ui, sans-serif` | Display (h1) |
| `--font-b` | same Outfit stack | Body — Outfit is the single UI face |
| `--font-m` | `"DM Mono", ui-monospace, Consolas, monospace` | Generated names, IDs, emails, URLs, versions (12px, `-.01em`) |
| Figtree 500/600 | `"Figtree", system-ui` | Platform-mimicry only: FB ad preview, poster top meta, floating preview picker |

Weights in use: 400 (body), 500 (nav items, tags), 600 (buttons, chips, strong), 700 (h2/h3, KPI
values, logo text), 800 (h1, theme cover names, batch pills, copy number).
`tabular-nums` on every numeric (`.num`). Eyebrow labels: 11–12px / 600–700 / `.08–.12em` tracking / uppercase.

## 3. Components

### Shell
1. **Sidebar rail** — floating rounded-24 indigo column: logo mark (gradient square + wordmark), brand-switcher button (translucent white card with avatar + "4 brands" + chevron), grouped nav (uppercase group labels; items with icon + label + right-aligned count `.c` or pink notification `.pill`), footer identity row with avatar + role.
2. **Top bar** — hamburger `ibtn` (≤900px only), search pill (`Ctrl K` kbd hint), theme-toggle ibtn, bell ibtn with pink dot, "Client view" button.
3. **Floating preview picker** (artifact-only demo chrome: theme + page switcher) — **not ported**.

### Primitives
4. **Buttons** — `.btn` (44px/r14), `.pri` (accent→pink gradient + glow), `.sm` (36px/r11), `.ghost`, `.danger`, `.ibtn` (44px square), `.link` (inline text + icon).
5. **Chip** — 24px pill, soft tone bg, leading 6px dot; `ring` variant (outlined dot = client track), `plain` (no dot); tones `t-ok/warn/bad/info/acc/neu`.
6. **Tag** — 26px outlined pill, optional icon.
7. **Tabs** (selected = solid accent + white), **Pills** (filter row w/ counts, `aria-pressed` solid accent), **Seg** (inset grid/gallery switch), **Subnav** (underline tabs).
8. **Field/Input** — 44px/r14, leading icon, focus = accent border + 4px `--accent-soft` ring.
9. **Switch** `.sw` — 44×26px, checked = accent gradient.
10. **Aspect-ratio glyph** `.ar` — bordered mini-rectangle + mono label for 9:16, 4:5, 1:1, 16:9.
11. **Toast** — fixed top-right, dark indigo card, green check, 3.2s self-dismiss.
12. **Banner** — indigo→purple gradient strip w/ icon tile (Themes global-library notice).
13. **Empty state** — centered h2 + p + optional action.

### Data display
14. **KPI tile** — gradient card (purple / pink / amber / green), icon tile, 44px value, delta line, inline smoothed sparkline SVG w/ endpoint dot, decorative circle; clickable → pre-filtered sheet.
15. **Area chart** — 640×240 SVG, two smoothed series w/ gradient fills, endpoint dots, gridlines at 0/4/8/12, alternating week labels.
16. **Donut** — 156px, rounded segment ends, centred total, side legend.
17. **Queue list** — toned round icon, title + mono sub, action button.
18. **Team load list** — avatar, count, segmented per-creative tone bar.
19. **Grid table** — min-width 1080, checkbox col, creative cell = mini poster + title + mono name, dual status chips ("Not with client yet" muted until internal approval), assignee `who` chip, format tag, dims, version mono, "Winning" trend badge; hover `--panel-2`, selected `--accent-soft`; whole row clickable + keyboard-openable.
20. **Poster thumbnail** — 4:5 generated night-sky art (gradient `--pbg`, fractal-noise overlay, stars, full/crescent moon, blanket arc), top meta chips (format·platform / duration), centred glass play button on video, bottom hook text; `mini` (38×48) and `nohook` variants. Deterministic from creative fields — no stored images.
21. **Gallery** — auto-fill minmax(200px) poster cards.

### Record drawer (Creative Sheet)
22. **Drawer** — 580px right panel: poster header + dual chips + mono name; sections: Approval (7-step internal + 3-step client **track bars**, client locked at 50% opacity until internal = approved), Details `dl.kv`, **Dimension picker** (aspect-glyph toggle buttons, save-as-you-pick), Script block, QA checklist (format-dependent items); footer: Focus mode, Cancel, Save. Focus-trapped, Esc closes, focus returns to opener.

### Page-specific cards
23. **Product card** — 16:10 `pack` art panel w/ gradient + inline product SVG + status badge; body: full name, landing/collection URL rows (mono), angle tags, `stats3` (Angles/Concepts/Creatives).
24. **Angle card** — 5px left stripe by first type, status chip, type chips (`type-emotional/functional/identity/critical` tone sets), **flame "Winning" badge** (pink→amber gradient), persona avatar chip + product tag, USP inset box, footer concept link.
25. **Theme card** — 16:9 cover (category gradient + giant icon glyph + glass category chip + 26px/800 name), 4-line clamped notes, refs/used-by tags, Active/Archived chip; archived = grayscale cover.
26. **Concept card** — gradient batch pill (46px/800), angle title + mono generated name, client chip, **formula row** (Angle × Theme in info-/bad-soft boxes), hypothesis blockquote (accent-soft left border), persona/product/style/format tags, overlapping mini-poster stack + count, Open button.
27. **Persona browser** — 320px selector cards (avatar, name, role, awareness + angle count; selected = accent ring) + detail panel: 72px avatar header, product tag, Edit; **awareness stepper** (5 steps, done = accent-soft, current = accent gradient + label, "Breakthrough Advertising" caption); `pgrid` of labelled `pbox`es w/ framework attributions (Cashvertising, Buyer Personas, Mindstates, StoryBrand); problem→transformation `ba` arrow row; trigger-word pills.
28. **Kanban board** — column-flow grid minmax(250px), inset columns (chip heading + count), creator cards (avatar, via-source, concept tags, partnership badge, mono tracking number, amber expiry alert).
29. **Creator pool card** — 96px gradient hero w/ overlapping avatar, status chip, handle, note, tags, expiry alert.
30. **Asset card** — 4:3 gradient thumb (kind chip, play/image glyph, duration pill), mono filename, caption, size + concept tag; dashed **drop zone** w/ gradient icon tile.
31. **Copy card** — numbered square + headline + mono creative name + status chip; **Facebook feed preview** (Figtree: brand avatar row + "Sponsored", primary text, 1.91:1 poster, link bar w/ domain/headline/desc/CTA button); spell-check status line.
32. **Team matrix** — people × 4 brands; role chips per cell in 5 role tones (`r-csm/media/strat/video/design` — pink/green/purple/blue/amber), Admin = "All brands", legend row.
33. **Template update card** — flow header (brand pill → gradient Template pill), table·field tag, status chip (Waiting/Promoted/Kept local); **old/new diff** (bad-soft strikethrough vs ok-soft); reviewer verdict box; requester + date; Keep local / **Promote to all brands** actions.
34. **Portal review card** — tall poster, theme tag + dims, mono name, Approve / Request revisions → inline textarea ("Add a timestamp like 0:12…") → Approved/Revisions-requested state w/ Undo.
35. **Portal chrome** — no sidebar; brand header (logo tile, "prepared by TAS Digital", theme toggle, back-to-workspace), portal tabs w/ counts, "X of N reviewed" green **progress bar**.
36. **Notification settings** — Slack connection card (TAS Bot, Connected chip, test-DM button), events × Slack/Email/In-app switch matrix w/ recipient-role tags, **Quiet hours** card (19:00–09:00 toggle).

### Iconography
Single inline SVG sprite, 1.75-stroke outline, 18px: home, box, users, target, swatch, bulb, sheet,
video, image, carousel, spark, user, folder, pen, gear, merge, search, bell, monitor, plus, down,
left, arrow, check, x, type, send, play, eye, menu, trend, filter, sort, layers, grid, upload, msg,
sun, moon, focus, hash, ext, link, flame, globe, truck, handshake, clock. (Repo equivalent: lucide —
keep lucide, match the stroke weight.)

## 4. Pages (14)

| # | Page | Layout |
|---|---|---|
| 1 | **Overview** | Greeting h1 w/ gradient em ("4 things need you today") + date eyebrow; 4 KPI tiles; `row2` (1.7fr/1fr): Production-pace area chart + Client-track donut w/ note; "With the client" 4-poster strip → portal; `row3` (1.25fr/1fr): "Needs you" queue + Team load list |
| 2 | **Products** | Header (Strategy / 3 products) + Import CSV + New product; 3-col product cards |
| 3 | **Personas** | Header + Import/New ("Paste research from Claude to fill all 14 fields"); 320px selector + detail panel |
| 4 | **Angles** | Header + filter pills (All/Winning/4 types w/ counts); 2-col angle cards |
| 5 | **Themes** | Header + global-library banner + category pills; 3-col theme cards |
| 6 | **Concepts** | Header + batch pills; 2-col concept cards |
| 7 | **Creative Sheet** | Header + toolbar (Grid/Gallery seg, search, Filter/Sort/Group) + 6 quick-filter status pills (All/In production/Needs review/Awaiting client/Ready to launch/Launched); grid table or gallery; row click → drawer |
| 8 | **UGC & Creators** | Header + 3 tabs (Pipeline/Creator pool/Partnership ads); kanban (5 status cols: Due shipment/Filming/Video delivered/Revisions needed/Approved) or pool card grid |
| 9 | **Asset Library** | Header + type pills (Reference/B-roll/Raw asset/Mood board); auto-fill grid, drop zone first |
| 10 | **Copywriting** | Header; 2-col copy cards w/ FB previews |
| 11 | **Client portal** | Portal chrome (no sidebar); review heading + progress; 3-col review cards |
| 12 | **Team** | Header + role legend; people × brands matrix |
| 13 | **Template updates** | Header ("N waiting"); pending request cards; History section |
| 14 | **Settings › Notifications** | Header + settings subnav (General/Team/Client portal/Notifications/Template updates/Fields & columns); Slack card; event × channel switch table; quiet hours |

Nav tree (artifact `shell()`): Overview · **Strategy**: Products, Personas, Angles, Themes, Concepts ·
**Production**: Creative Sheet, UGC & Creators, Asset Library · **Copy**: Copywriting · **Workspace**:
Client portal, Team, Template updates (pending-count pill), Settings. Items carry record counts.

Status vocab in the artifact matches the repo's canonical domain values (`revisions_submitted`,
`revisions_needed`, `pending_for_approval`, …). The artifact's CLIENT map omits `disapproved` (added
to the repo Oct 7) — **repo vocabulary wins**; render `disapproved` with tone `bad`.

## 5. Gap list — artifact component → repo file

Legend: **RESTYLE** = keep logic, swap skin · **REWRITE** = structural rebuild · **NEW** = does not exist.

| Artifact piece | Repo file | Verdict |
|---|---|---|
| Token layer | `packages/ui/src/styles/tokens.css` | **REWRITE values** — keep the semantic class contract (`bg-surface`, `text-text2`, `border-line`, `bg-accent`, `rounded-card`…), repoint every value; add `--accent-2`, side-rail group, chart group, tone softs |
| Fonts | `apps/web/src/app/layout.tsx` (next/font) | **REWRITE** — Outfit + DM Mono + Figtree replace current faces |
| Sidebar rail | `apps/web/src/components/shell/sidebar.tsx` | **REWRITE** — floating rounded indigo rail, white-pill active state, counts |
| Brand switcher | `shell/brand-switcher.tsx` + `org-switcher.tsx` | **RESTYLE** — translucent card look |
| Nav tree + counts | `shell/nav.ts` | **EXTEND** — groups/labels already close (Overview/Strategy/Production/Copy/Workspace); add per-item record counts + Template-updates pending pill |
| Top bar | `shell/top-bar.tsx` | **REWRITE** — search pill w/ kbd, ibtn cluster, Client view |
| Theme toggle | `shell/theme-toggle.tsx` | **RESTYLE** (ibtn) |
| Buttons | shadcn button in `packages/ui/src/components` | **RESTYLE** — variants pri-gradient/sm/ghost/danger via tokens |
| StatusChip | `packages/ui/src/status/status-chip.tsx` | **RESTYLE** — leading dot, `ring` client-track variant; `chipTone` mapping unchanged |
| ClientStatusBadge / SoonChip | `packages/ui/src/status/` | **RESTYLE** |
| StepRow (approval steps) | `packages/ui/src/status/step-row.tsx` | **REWRITE** → segmented track bars (`--n` grid, done/current/locked) |
| Tabs/Pills/Seg/Subnav | — | **NEW** `packages/ui/src/forms/` primitives + stories |
| Switch | — | **NEW** (or restyled shadcn switch) |
| Toast | existing toast/sonner in apps/web | **RESTYLE** indigo card |
| KPI tile + sparkline | `apps/web/src/components/overview/` | **NEW** |
| Area chart / donut | `apps/web/src/components/overview/` | **NEW** (inline SVG, no chart dep — honors 500 USD/yr ceiling) |
| Queue / team-load lists | `components/queue/`, `overview/` | **REWRITE** |
| Poster thumbnail | — | **NEW** `apps/web/src/components/briefs/poster.tsx`, deterministic from creative fields |
| Grid table | `components/views/airtable-grid.tsx` | **RESTYLE** — poster cell, dual-status, hover/selected tones; logic + renderer registry untouched |
| Gallery view | views (gallery exists per memory) | **RESTYLE** poster cards |
| Record drawer | `apps/web/src/app/app/creative-sheet/creative-sheet-panel.tsx` | **REWRITE skin** — keep InlineField wiring (B5 Fix A–C), qa-gate and transition actions byte-identical |
| Dimension picker | creative-sheet panel | **NEW control** (saves via `updateBriefPartialAction` multiSelect path) |
| Product card | `app/products/` + `product-panel.tsx` | **REWRITE** cards; keep reverse-lists data from Flow run |
| Angle card | `app/angles/` | **REWRITE** cards |
| Theme card | themes page | **REWRITE** cards |
| Concept card | `app/concepts/` | **REWRITE** cards (formula, batch pill, poster stack) |
| Persona browser | `app/personas/` + `persona-panel.tsx` | **REWRITE** layout; keep linked-product picker (Flow GAP-1) |
| Kanban board | `app/ugc/ugc-workspace.tsx` | **REWRITE** board skin |
| Creator pool card | ugc | **NEW** |
| Asset card + drop | `components/assets/` + `app/.../assets` | **REWRITE** |
| Copy card + FB preview | `app/copywriting/copy-panel.tsx` | **REWRITE** — FB preview is NEW |
| Team matrix | `app/team/` | **REWRITE** |
| Template update diff card | `packages/ui/src/propagation/` + review queue page | **REWRITE** cards (old/new diff, flow pills) |
| Portal chrome + review cards | client portal pages | **REWRITE** — progress bar + inline revision textarea NEW |
| Notification settings | notifications page | **REWRITE** — switch matrix, Slack card, quiet hours |
| Empty states | per page | **RESTYLE** |
| Floating preview picker | — | **DROP** (artifact demo chrome) |

**Invariants the redesign must not touch:** state machines / qa-gate / transition actions, `canEditBrief`,
`updateBriefPartialAction`, InlineField behaviour (skin only), resolver-driven columns, brand scoping,
status vocab, migrations. This is a presentation-layer chain; `packages/db` and `packages/domain` see
zero diffs.

## 6. Redesign chain — 8 commits, in order

Each commit passes the four gates (typecheck 0 · lint 0 · tests ≥ floor · build green) + Vercel
`/api/version` sha-match before the next starts. Diff ≤300 LOC net each (excl. tests/stories);
every new/changed primitive lands a story on `/design-system` in the same commit.

1. **`feat(ui): Bold token layer — colors, radii, shadows, fonts`**
   Rewrite `tokens.css` values for light+dark per §1; add missing tokens (`--accent-2`, side group,
   chart group); load Outfit/DM Mono/Figtree via `next/font`; map any new Tailwind semantic classes.
   No component file changes. The whole app re-skins coarsely in one diff; visual polish follows.
   *Risk: existing tests asserting current colors/fonts — fix those assertions honestly (values
   changed by design).*

2. **`feat(shell): indigo rail sidebar + top bar`**
   `sidebar.tsx`, `top-bar.tsx`, `nav.ts` (counts + pending pill), brand-switcher restyle,
   portal-mode (no rail) handling, ≤900px overlay nav + scrim.

3. **`feat(ui): Bold primitives — chips, buttons, tabs, pills, seg, switch, toast`**
   StatusChip dot/ring variants, button variants, new Tabs/Pills/Seg/Subnav/Switch, toast skin,
   banner, empty state. Stories for every one.

4. **`feat(briefs): poster thumbnail + Creative Sheet drawer reskin`**
   `poster.tsx` (deterministic night-sky art, mini/nohook variants); drawer: track bars (StepRow
   rewrite), dimension picker, QA checklist, kv details — all on existing InlineField/action wiring.

5. **`feat(views): grid + gallery reskin`**
   `airtable-grid.tsx` skin (poster cell, dual status, hover/selected), gallery poster cards,
   toolbar (seg + search + quick-filter pills) on the Creative Sheet page.

6. **`feat(pages): Strategy pages — products, personas, angles, themes, concepts`**
   The five §3.23–27 card systems + persona browser layout + filter pills per page.

7. **`feat(pages): Production + Workspace — ugc, assets, copy, team, template, settings, overview`**
   Kanban board, creator pool, asset grid + drop zone, copy FB preview, team matrix, template diff
   cards, notification settings, Overview dashboard (KPI tiles, area chart, donut, queue, team load).
   *Largest surface — split into 7a (production) / 7b (workspace + overview) if >300 LOC net.*

8. **`feat(portal): client portal Bold`**
   Portal chrome, review cards with inline revision flow, progress bar, portal tabs. Client-facing:
   zero internal data leakage re-verified by existing portal tests.

Suggested verification after 8: screenshot pass over all 14 pages in light + dark at desktop/900px
widths into `docs/qa/bold-redesign/`, compared against the artifact.

---

*Spec extracted 2026-10-16 from the artifact (1247 lines, read in full). Implementation has not started;
`apps/web` and `packages/*` are untouched by this commit.*
