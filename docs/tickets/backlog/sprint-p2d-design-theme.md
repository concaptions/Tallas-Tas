# P2D — TAS theme: purple gradient + white, emojis, full-width

**Role**: frontend + design-system · **PRD**: §UI governance · **Est**: M · **Blockers**: none

> "I like emojis, they are more friendly" — Talal. Warm/approachable, not enterprise-serious.

## Acceptance criteria
- [ ] Purple-gradient + white theme defined in the token layer (`packages/ui/src/styles/tokens.css`); dark-mode tokens too. No hex values in components — semantic classes only (`bg-surface`, `text-text2`, `bg-accent`, …)
- [ ] Emojis / icons used across nav, metric cards, section headers (friendly tone)
- [ ] Full-width tables — remove empty side margins that waste horizontal space (ties into P2A grid)
- [ ] Auto-generated system output (concept/creative names, IDs) stays `font-mono`
- [ ] Every changed primitive rendered on `/design-system`; reviewer checks UI-governance order

## Notes
Do the token change first (P2D) so P2A/P2B build on the final palette. Keep `rounded-full`
off buttons (UI governance).
