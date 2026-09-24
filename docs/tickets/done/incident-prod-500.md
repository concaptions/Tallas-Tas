# INCIDENT-001 — Production served a raw server-side exception (digest 3619938306)

PRD: none (operational hardening). Reported 2026-09-24.

## Report

`tallas-tas-pi.vercel.app` went from a handled "Database is not configured" message to Next.js's
bare "Application error: a server-side exception has occurred", digest `3619938306`, immediately
after `DATABASE_URL` and a copied Railway variable set (`PGHOST`, `PGPORT`, `PGUSER`, `PGDATABASE`,
`POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `DATABASE_PUBLIC_URL`) were added to the
Vercel Production environment.

## What the evidence showed

The runtime logs could not be read: the Vercel project lives on an account the CLI on this machine
is not authorised for (`vercel whoami` is `zaman152`, whose single team holds no `tallas-tas`
project), so digest `3619938306` could not be resolved to a stack. The deployment has since been
replaced and the exception is no longer reproducible: every protected route now answers `307` to
`/sign-in` and `/sign-in` itself answers `200`, so the crash — whatever threw — now sits behind
Clerk and cannot be reached anonymously.

The hijack hypothesis was measured rather than assumed, against the installed `pg`
(`lib/connection-parameters.js`, `val()` = `config[key] || process.env['PG'+KEY] || defaults[key]`):

| Ambient var | Overrides a fully specified `DATABASE_URL`? |
| --- | --- |
| `PGHOST`, `PGUSER`, `PGDATABASE`, `PGPASSWORD` | No — the parsed URL field is truthy and wins |
| `PGPORT` | **Yes**, when the URL omits the port |
| `PGSSLMODE` | **Yes**, always — `parse()` leaves `ssl` undefined unless the URL carries `sslmode`, and `ConnectionParameters` then calls `readSSLConfigFromEnvironment()` |

So the connection was never rerouted to another host, and the vars the reporter listed do not
contain `PGSSLMODE` or `PGPASSWORD`. **The PG\* set did not cause this incident.** It is still a
live latent fault: adding `PGSSLMODE` to that environment would silently flip TLS on or off.

## Fixed here

1. `createNodeDb` builds the pool field by field from the parsed URL, including `ssl` derived from
   the URL's own `sslmode`, so no ambient libpq variable can reach the connection.
2. A root-segment `error.tsx`. The app had **no error boundary of any kind**, which is why a throw
   rendered Next's bare digest screen — that presentation, not the throw, is what changed for the
   reporter. It sits at the root segment deliberately: the likely throw site is
   `app/app/layout.tsx` (it awaits `currentBrand()`), and a boundary never catches its own layout.

## Acceptance

- `packages/db/src/db.test.ts` plants the full decoy environment and asserts the pool still aims at
  the URL. Verified to FAIL against the previously deployed `new PgPool({ connectionString })`
  (`expected true to be false` on the `PGSSLMODE` case) and pass after.
- `apps/web/src/lib/error-notice.test.ts` asserts the boundary copy names no environment variable,
  host or table (non-negotiable 10 — a brand client reaches the same boundary).
- `pnpm typecheck`, `pnpm lint`, `pnpm test` (140 files, 1955 tests) green.

## Still on the human

- Delete `PGHOST`, `PGPORT`, `PGUSER`, `PGDATABASE`, `POSTGRES_USER`, `POSTGRES_PASSWORD`,
  `POSTGRES_DB` from Vercel Production. They are inert for the app after this change and were never
  read by it, but they are a loaded footgun for any other Postgres client added later.
- Resolving digest `3619938306` to a stack needs a `vercel login` as the account that owns the
  project, then `vercel link` and `vercel logs`.
- `packageManager` pins `pnpm@12.4.2` while corepack now serves `12.5.1`, so every root script
  fails `ERR_PNPM_BAD_PM_VERSION` unless the pinned binary is first on `PATH`. Pre-existing, not
  touched here.
