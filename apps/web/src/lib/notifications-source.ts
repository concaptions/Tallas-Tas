import {
  brands,
  createNeonDb,
  demoNotifications,
  listNotifications,
  type Db,
  type NotificationSettingRow,
} from '@tas/db';
import { serverEnv } from '@tas/env';

import { DEMO_MUTATION_REFUSED, isDemoMode } from './demo-mode';

/**
 * Where the Notifications route gets its rows (PRD §12: "notifications go as **Slack direct
 * messages to the assigned person**", one row per trigger with a Slack DM switch and an email
 * switch). A copy of `personas-source.ts` and `interface-config-source.ts`, function for function,
 * because the demo-mode guarantee is the same one and it must not drift between routes.
 *
 * DEMO MODE (no `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, read through `@tas/env`, never `process.env`):
 * the in-repo fixtures from `@tas/db`. No database client is constructed, no connection is opened
 * and `DATABASE_URL` is never read, even when it is set — the demo branch returns BEFORE
 * `serverEnv()` is reached, and `notifications-source.test.ts` proves it with an injected `connect`
 * spy that throws if it is ever called. That is what makes the unauthenticated Vercel deployment
 * safe: the middleware lets every route through, so a visitor must be unable to reach real data.
 *
 * LIVE MODE (Clerk configured): a Neon connection opened per call and closed in a `finally`, the
 * actor's brand resolved from `brands`, then the scoped queries in `@tas/db`. No singleton.
 *
 * `demoNotifications` and a seeded database are row-for-row identical, ids included, so the table
 * renders one branch either way.
 *
 * WHAT THIS MODULE DOES NOT DO: routing. A row carries the trigger's label, the §11 roles and the
 * Recipient cell's reading of them, and all three are joined in by `@tas/db` from the `§12` tuple —
 * who actually receives the DM is the brand's team assignment made at onboarding, which is not a
 * value on these rows and is not editable from this page. There is no second opinion about it here.
 *
 * It also does not FILTER: a trigger with both switches off is returned, because the settings table
 * has to show a muted trigger in order to switch it back on.
 */
export type NotificationSourceKind = 'database' | 'demo';

export interface NotificationListResult {
  readonly rows: NotificationSettingRow[];
  readonly source: NotificationSourceKind;
}

export interface NotificationResult {
  readonly notification: NotificationSettingRow | null;
  readonly source: NotificationSourceKind;
}

/** An open database handle and the way to close it again. */
export interface DbConnection {
  readonly db: Db;
  readonly close: () => Promise<void>;
}

/**
 * Seams, for tests only. Production calls every function with no argument: `demoMode` reads the
 * environment through `@tas/env` and `connect` opens Neon. A test injects `connect` to prove the
 * demo branch never constructs a client.
 */
export interface NotificationSourceDeps {
  readonly demoMode?: () => boolean;
  readonly connect?: (databaseUrl: string) => DbConnection;
}

function neonConnection(databaseUrl: string): DbConnection {
  const db = createNeonDb(databaseUrl);
  return { db, close: () => db.$client.end() };
}

/** Opens a connection, runs `query`, and always closes the pool. Live mode only. */
async function withDb<T>(deps: NotificationSourceDeps, query: (db: Db) => Promise<T>): Promise<T> {
  const connect = deps.connect ?? neonConnection;
  const connection = connect(serverEnv().DATABASE_URL);
  try {
    return await query(connection.db);
  } finally {
    await connection.close();
  }
}

function inDemoMode(deps: NotificationSourceDeps): boolean {
  return (deps.demoMode ?? isDemoMode)();
}

/**
 * The working brand: the first live client workspace, never the parent template. A single-brand V0
 * shell needs no more; per-membership selection arrives with the brand switcher.
 */
async function liveBrandId(db: Db): Promise<string | null> {
  const rows = await db.select().from(brands);
  return rows.find((row) => row.deletedAt === null && !row.isTemplate)?.id ?? null;
}

/**
 * The brand's eight notification settings in PRD §12's order, each already carrying its label, its
 * §11 recipient roles and the Recipient cell's reading of them.
 */
export async function loadNotifications(
  deps: NotificationSourceDeps = {},
): Promise<NotificationListResult> {
  if (inDemoMode(deps)) {
    return { rows: demoNotifications, source: 'demo' };
  }
  return withDb(deps, async (db) => {
    const brandId = await liveBrandId(db);
    const rows = brandId === null ? [] : await listNotifications(db, brandId);
    return { rows, source: 'database' };
  });
}

/**
 * One setting by its TRIGGER KEY, or null. The key is the row's identity on this page — a switch
 * reports "email, on, for `ad_submitted`" and never an id — so this is the lookup the page has.
 * In demo mode the fixtures are searched; no client is built.
 */
export async function loadNotification(
  triggerKey: string,
  deps: NotificationSourceDeps = {},
): Promise<NotificationResult> {
  if (inDemoMode(deps)) {
    return {
      notification: demoNotifications.find((row) => row.triggerKey === triggerKey) ?? null,
      source: 'demo',
    };
  }
  return withDb(deps, async (db) => {
    const brandId = await liveBrandId(db);
    const rows = brandId === null ? [] : await listNotifications(db, brandId);
    return {
      notification: rows.find((row) => row.triggerKey === triggerKey) ?? null,
      source: 'database',
    };
  });
}

/**
 * The write path for the Server Action: one connection, the actor's brand resolved once, then
 * `run`. Throws in demo mode — a mutation must never reach a database the demo visitor cannot own —
 * and returns null when the workspace has no brand yet.
 *
 * The action never lets that throw escape: it refuses in demo mode BEFORE it gets here, so this is
 * the belt to that pair of braces rather than the path a demo visitor takes.
 */
export async function withBrandScope<T>(
  run: (db: Db, brandId: string) => Promise<T>,
  deps: NotificationSourceDeps = {},
): Promise<T | null> {
  if (inDemoMode(deps)) {
    throw new Error(DEMO_MUTATION_REFUSED);
  }
  return withDb(deps, async (db) => {
    const brandId = await liveBrandId(db);
    return brandId === null ? null : run(db, brandId);
  });
}
