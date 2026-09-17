import { clientEnv, type EnvSource } from '@tas/env';

/**
 * DEMO MODE is the state the app runs in when no identity provider is configured, which is exactly
 * what the Vercel deployment looks like today: no environment variables at all.
 *
 * "Clerk configured" means `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` is present, read through `@tas/env`
 * (never `process.env`, CLAUDE.md "Architecture principles"). With no key there is no session to
 * protect, so the middleware lets every route through; what makes that safe is the other half of the
 * rule, enforced in `src/lib/data-source.ts`: in demo mode the app NEVER reads the database, even if
 * `DATABASE_URL` is set, and every mutation is refused. An unauthenticated visitor can therefore
 * only ever see the in-repo fixtures.
 */
export interface DemoActor {
  readonly fullName: string;
  readonly email: string;
  readonly initials: string;
}

/** The stub actor the shell shows when there is no identity provider to ask for a real one. */
export const DEMO_ACTOR: DemoActor = {
  fullName: 'Demo User',
  email: 'demo@tas-digital.com',
  initials: 'DU',
};

/** The banner copy under the top bar. Part of the specification, not a label. */
export const DEMO_MODE_NOTICE =
  'Demo mode — sample data, changes are not saved. Connect Clerk and a database to go live.';

/** Every mutation refused in demo mode answers with this. */
export const DEMO_MUTATION_REFUSED =
  'Demo mode: sample data is read-only. Connect Clerk and a database to save changes.';

/**
 * True when Clerk is not configured. `source` exists for tests; production passes nothing and
 * `clientEnv()` reads the literal `process.env.NEXT_PUBLIC_*` expressions Next.js inlines.
 */
export function isDemoMode(source?: EnvSource): boolean {
  return clientEnv(source).NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY === undefined;
}

/**
 * The seeded team member the Internal Queue's "Mine" view acts as (ticket `internal-queue.md`
 * criterion 9). Demo mode has no session, so `DEMO_ACTOR` is a stub whose name matches no brief;
 * pointing "Mine" at it would show an empty board and read as a bug rather than as a filter. This
 * is deliberately a SECOND constant and NOT a change to `DEMO_ACTOR`: the top bar must keep saying
 * "Demo User" — the shell is honest about having no identity — while the queue still has a real
 * person to narrow to.
 *
 * The value is one of the three assignees already written into `demoBriefs`; it adds no fixture and
 * changes no row. `internal-queue-source.test.ts` pins it against the fixtures, so renaming a
 * seeded assignee fails there instead of silently emptying the view. In live mode the viewer is the
 * actor's full name from `currentActor()` and this constant is never read.
 */
export const DEMO_QUEUE_ASSIGNEE = 'Dorian Vance';
