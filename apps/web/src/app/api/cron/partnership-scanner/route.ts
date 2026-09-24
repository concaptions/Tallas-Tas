import { createAutoDb, runPartnershipScanner } from '@tas/db';
import { PARTNERSHIP_REMINDER_DAYS } from '@tas/domain/creators';
import { serverEnv } from '@tas/env';
import { NextResponse } from 'next/server';

/**
 * The scheduled partnership scanner (PRD §5.8.1), run by Vercel Cron — the schedule lives in
 * `vercel.json`. There is no Inngest in this stack (docs/decisions.md D-023/D-030), so a plain cron
 * route is the scheduler: once a day it opens one connection and runs the cross-brand scan that alerts
 * on expiring partnerships, auto-renews the ones the brand said "yes" to, auto-ends the ones it said
 * "no" to once their window lapses, and flags the ones nobody decided.
 *
 * AUTH IS A SHARED SECRET. Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`; the route refuses
 * anything else, so the URL being public does not let a stranger run a platform-wide job. With no
 * `CRON_SECRET` configured (demo, local) the route refuses everything — there is nothing to run there.
 *
 * ONE CONNECTION, ENDED IN A `finally`. This is a job, not a page render, so it does not use the
 * request-scoped pool; it opens its own and closes it, no singleton (CLAUDE.md).
 */
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  const env = serverEnv();

  if (env.CRON_SECRET === undefined) {
    return NextResponse.json({ error: 'Cron is not configured.' }, { status: 503 });
  }
  if (request.headers.get('authorization') !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  if (env.DATABASE_URL === undefined) {
    return NextResponse.json({ error: 'No database configured.' }, { status: 503 });
  }

  const db = createAutoDb(env.DATABASE_URL);
  try {
    const result = await runPartnershipScanner(db, {
      now: new Date(),
      reminderDays: PARTNERSHIP_REMINDER_DAYS,
    });
    return NextResponse.json({ ok: true, ...result });
  } finally {
    await db.$client.end();
  }
}
