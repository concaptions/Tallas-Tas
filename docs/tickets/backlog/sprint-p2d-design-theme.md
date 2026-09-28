# P2D — TAS theme: purple gradient + white, emojis, full-width

**Role**: frontend + design-system · **PRD**: §UI governance · **Est**: M · **Blockers**: none

> "I like emojis, they are more friendly" — Talal. Warm/approachable, not enterprise-serious.

## Acceptance criteria
- [x] Purple-gradient + white theme defined in the token layer (`packages/ui/src/styles/tokens.css`); dark + light tokens, `--accent-gradient` added. `no-hex` + `no-undefined-tokens` pass (no hex outside tokens.css)
- [x] `.bg-brand-gradient` utility in `globals.css` (references the token; used for brand surfaces)
- [x] Emojis on the workspace nav sections (📦🎭🎯🎨💡📋✍️🎬… via a `NavSection.emoji` field, rendered in place of the lucide icon)
- [x] Full-width content (removed `max-w-5xl` on the app shell so tables stretch)
- [x] typecheck 6/6, lint clean, test 1964/1964
- [ ] Metric-card emojis → land with P3 (Overview) · empty-state emojis → land with P2A (grid empty state); no shared empty-state component exists to centralise
- [ ] **Visual confirmation pending the deployed Vercel env** — local dev can't render (offline `next/font/google` + live-mode auth). Verify purple palette + gradient on tallas-tas-pi.vercel.app after deploy

## Notes
Do the token change first (P2D) so P2A/P2B build on the final palette. Keep `rounded-full`
off buttons (UI governance).
