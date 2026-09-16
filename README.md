# Tallas-Tas · TAS Creative Platform

Multi-tenant replacement for the TAS Digital Airtable Creative Hub: an internal briefing workspace for
the creative team and a per-brand approval interface for clients, with one parent template propagating
to every brand.

- Product intent: [docs/PRD.md](docs/PRD.md)
- Engineering rules every change follows: [CLAUDE.md](CLAUDE.md)
- Decisions log: [docs/decisions.md](docs/decisions.md) · Glossary: [docs/glossary.md](docs/glossary.md)
- Runbook (commands, credentials, pending verifications): [docs/runbook.md](docs/runbook.md)
- Phase 2 template-engine design: [docs/design/template-engine.md](docs/design/template-engine.md)
- Work tracking: [docs/tickets/backlog.md](docs/tickets/backlog.md), `docs/tickets/{backlog,in-progress,done}/`

## Stack

Next.js 15 (App Router, React 19, TypeScript strict) · Postgres on Neon with Drizzle ORM · Clerk ·
shadcn/ui + Tailwind CSS 4 · Inngest · Cloudflare R2 · Resend · Vercel · Vitest + Playwright ·
pnpm workspaces + Turborepo. Database tests run on PGlite; no local Postgres is needed.

## Quick start

```bash
corepack enable pnpm   # pnpm 12
pnpm install
pnpm typecheck && pnpm lint && pnpm test
pnpm dev
```

See `.env.example` for every environment variable and `docs/runbook.md` for the rest.
