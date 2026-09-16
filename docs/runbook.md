# Runbook

## Prerequisites

- Node 24 (`.node-version`). pnpm 12 through corepack: `corepack enable --install-directory ~/.local/bin pnpm`.
- No local Postgres is needed. Unit tests use PGlite. `pnpm dev` against a real database needs `DATABASE_URL`.

## Everyday commands (repo root)

```bash
pnpm install
pnpm dev          # Next.js app
pnpm typecheck
pnpm lint
pnpm test         # Vitest, all packages
pnpm test:e2e     # Playwright
pnpm build
```

## Credentials the platform needs

| Variable | Service | Who provides | Needed from |
| --- | --- | --- | --- |
| `DATABASE_URL` | Neon (main branch) | Human creates the Neon project | TICKET-003 |
| `DATABASE_URL` (preview) | Neon preview branch | Human | TICKET-003 |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | Clerk, organisations enabled | Human | TICKET-004 |
| `SLACK_BOT_TOKEN` | Existing TAS Bot app | Human | Phase 5 |
| `RESEND_API_KEY` | Resend | Human | Phase 5 |
| `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY` | Inngest | Human | Phase 2 |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` | Cloudflare R2 | Human | Phase 4 |
| `ANTHROPIC_API_KEY` | Anthropic | Human | Phase 5 |
| `AIRTABLE_PAT` | Airtable, read access to Creative Hub bases | Human | Phase 6 |

Never paste secrets into the repo or into chat. Put them in `.env.local` (gitignored).

## Pending human verification

Items whose acceptance criteria are gated on credentials (see D-008). Each line gives the exact command.

(none yet)

## Migrations

(filled by TICKET-003)

## Rolling a schema change out to every brand

(filled in Phase 2)

## Backup and restore

(Phase 7: Neon point-in-time restore procedure)

## Secrets rotation

(Phase 7)
