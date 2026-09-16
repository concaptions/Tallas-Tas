# TICKET-DS-01 · Land the design tokens

- Owners, in order: integrator (stage 1, `packages/ui` package skeleton and Tailwind source wiring) then frontend (stage 2, tokens, fonts, tokens page, screenshot tests)
- Size: M
- Depends on: TICKET-002, TICKET-012b
- PRD: §10 (client interface), §11 (workspace); design handoff "TICKET-DS-01" (2026-09-16)
- Design: the Two-Track Approval artifact's token set, transcribed verbatim below

## Why

Every UI in the product inherits one palette, two fonts and two radii. Landing them as Tailwind semantic
classes before the first real component means no component ever carries a hex value.

## Stage 1 (integrator) · `packages/ui` skeleton

1. Package `@tas/ui` (`packages/ui`): `package.json` with `react` and `react-dom` as peer dependencies,
   `tsconfig.json` extending the base with `jsx: react-jsx`, Vitest config with `happy-dom` (or `jsdom`)
   and `@testing-library/react`, `src/index.ts`, `src/styles/tokens.css`. `apps/web` depends on it and its
   `globals.css` gains `@source "../../../packages/ui/src"` so Tailwind compiles classes used in
   `@tas/ui` components.
2. Move the shadcn `Button` and `cn` helper from `apps/web/src/components/ui` and `apps/web/src/lib/utils.ts`
   into `packages/ui/src/{components/button.tsx, lib/cn.ts}`; `components.json` in `apps/web` points its
   aliases at `@tas/ui`. `apps/web` imports `Button` from `@tas/ui`. (CLAUDE.md layout: shadcn lives in
   `packages/ui`.)
3. `docs/decisions.md` gets a new entry listing the dependencies added.

## Stage 2 (frontend) · tokens, fonts, tokens page

4. `packages/ui/src/styles/tokens.css` defines the raw tokens on `:root` (warm dark, the default) and the
   warm light overrides under both `:root[data-theme="light"]` and
   `@media (prefers-color-scheme: light) { :root:not([data-theme="dark"]) }`. Values are exactly:

   Dark: `--bg #14110F`, `--bg-deep #0D0B0A`, `--surface #1C1916`, `--surface2 #221C17`, `--surface3 #241F1B`,
   `--surface4 #2B251F`, `--line #2E2823`, `--line2 #3B332B`, `--text #EAE4DB`, `--text2 #CFC6B9`,
   `--text3 #948A7F`, `--text4 #756A60`, `--accent #D98B4A`, `--accent-line #B36A2B`,
   `--accent-soft color-mix(in srgb, #D98B4A 22%, transparent)`, `--ok #7A9B6B`, `--warn #C69A46`,
   `--bad #AB6753`, `--info #7688A0`, `--mono 'JetBrains Mono', ui-monospace, monospace`,
   `--sans 'Inter', ui-sans-serif, system-ui`.

   Light: `--bg #FAF8F5`, `--surface #FFFDFA`, `--surface2 #F3EFE9`, `--surface3 #EDE7E0`, `--surface4 #E2DBD1`,
   `--line #CFC6B9`, `--line2 #A79D93`, `--text #241F1B`, `--text2 #3B332B`, `--text3 #6B6057`,
   `--text4 #948A7F`, `--accent #93513D`, `--accent-line #93513D`,
   `--accent-soft color-mix(in srgb, #93513D 18%, transparent)`. Light keeps `--bg-deep`, `--ok`, `--warn`,
   `--bad`, `--info` from dark (not specified by the design; recorded as open question DS-Q2).
5. The same file maps the tokens into Tailwind 4 with `@theme inline`: `--color-bg`, `--color-bg-deep`,
   `--color-surface`, `--color-surface2`, `--color-surface3`, `--color-surface4`, `--color-line`,
   `--color-line2`, `--color-text`, `--color-text2`, `--color-text3`, `--color-text4`, `--color-accent`,
   `--color-accent-line`, `--color-accent-soft`, `--color-ok`, `--color-warn`, `--color-bad`, `--color-info`
   (each `var(--token)`), `--font-sans: var(--sans)`, `--font-mono: var(--mono)`, `--radius-input: 6px`,
   `--radius-card: 8px`. Result: `bg-surface`, `text-text2`, `border-line`, `bg-accent`, `text-ok`,
   `font-mono`, `rounded-input`, `rounded-card` and the rest work as utilities and follow the theme at
   runtime. No `tailwind.config.ts` (Tailwind 4 is CSS-first; decision entry below). shadcn's own
   variables (`--background`, `--primary`, `--radius`, …) are aliased to these tokens in the same file so
   shadcn components inherit the palette.
6. Fonts: `apps/web/src/app/layout.tsx` loads Inter (400, 500, 600) and JetBrains Mono (400, 500) through
   `next/font/google` with `variable: '--font-inter'` / `'--font-jetbrains-mono'`; `tokens.css` sets
   `--sans: var(--font-inter), ui-sans-serif, system-ui` and `--mono: var(--font-jetbrains-mono),
   ui-monospace, monospace`. `body` uses `font-sans`; a `.sys` utility (or `font-mono` on the element) is
   the rule for auto-generated system output: concept names, creative names, IDs.
7. Radii: 6px inputs and chips (`rounded-input`), 8px cards (`rounded-card`); `rounded-full` is forbidden
   on buttons (lint rule `no-restricted-syntax` on the class name `rounded-full` inside button components;
   CLAUDE.md governance rule 1).
8. No hex outside the token file: ESLint `no-restricted-syntax` rejects string literals and template
   literals matching `#[0-9a-fA-F]{3,8}\b` in `apps/web/src/**/*.{ts,tsx}` and `packages/ui/src/**/*.{ts,tsx}`;
   a Vitest test in `packages/ui` greps `apps/web/src` and `packages/ui/src` for hex values in `.css` files
   and fails on any file other than `tokens.css`.
9. Tokens page at `apps/web/src/app/(dev)/design-system/tokens/page.tsx`: renders every color token as a
   swatch (name, CSS variable, resolved value read with `getComputedStyle` in a client island), every text
   style as a labelled sample (sans 400/500/600, mono 400/500 at the sizes used: 10.5px chip, 12px, 13px,
   14px, 16px, 20px), both radii, and a theme toggle (`data-theme` on `<html>`, remembered in
   `localStorage`, wrapped in try/catch). Reachable through the TICKET-012b test session.
10. Playwright `apps/web/e2e/design-tokens.spec.ts`: two projects or two tests with `colorScheme: 'dark'`
    and `'light'`, each `toHaveScreenshot('tokens-<theme>.png')` with baselines committed under
    `apps/web/e2e/__screenshots__/`; a third test forces `data-theme="light"` under a dark color scheme and
    asserts the `--bg` computed value is `rgb(250, 248, 245)`.
11. `docs/decisions.md` entry "Design system: Tailwind 4 `@theme inline` instead of `tailwind.config.ts`;
    tokens live in `packages/ui`" with the reason; `docs/decisions.md` gains the section
    "Design system open questions" (see Notes).

## Gated criteria (D-008)

none (screenshot tests run locally through TICKET-012b).

## Files touched

`packages/ui/**`, `apps/web/src/app/globals.css`, `apps/web/src/app/layout.tsx`,
`apps/web/src/app/(dev)/design-system/tokens/page.tsx`, `apps/web/components.json`,
`apps/web/package.json`, `apps/web/e2e/design-tokens.spec.ts`, `apps/web/e2e/__screenshots__/*`,
`eslint.config.js`, `docs/decisions.md`.

## Notes

- The handoff says "create `apps/web/app/globals.css` and `apps/web/tailwind.config.ts`". The app uses
  `src/app` (TICKET-002) and Tailwind 4, so the tokens land in `packages/ui/src/styles/tokens.css`
  imported by `apps/web/src/app/globals.css`, and the semantic classes come from `@theme inline`. Same
  outcome (semantic classes, no hex in components), one source file. Recorded as a decision.
- Open questions to append under "Design system open questions": DS-Q1 the design artifact file was not
  delivered (not on disk, not a Claude artifact, not in Drive on 2026-09-16), so layout geometry comes from
  the written handoff only; DS-Q2 light-theme values for `--bg-deep`, `--ok`, `--warn`, `--bad`, `--info`
  are not specified; DS-Q3 whether `(On Hold)` needs a tone of its own.
- Use `next/font/google` only; it downloads at build time, which needs network on the build machine.
