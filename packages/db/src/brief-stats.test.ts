import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import {
  approvedThisWeek,
  avgRevisionHours,
  briefsInFlight,
  loadBriefStats,
  pairRevisionRows,
  perEditorBars,
  qaPassRatePct,
  startOfWeekMonday,
  trailingThirtyStart,
  turnaroundTable,
  weeklyOutput,
} from './brief-stats';
import { activityLog, briefSubmissions, creativeBriefs } from './schema';
import { seed } from './seed';
import { testDb, type PgliteDb } from './testing';

/**
 * The Creative Sheet stats loaders (Ticket 12). PGlite proves the KPI math across the seeded brand:
 * every tile, the per-editor bars, the weekly line and the turnaround table share one activity
 * ledger and one submissions table. Dates are frozen through `now: Date`.
 */

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

interface Fixture {
  readonly db: PgliteDb;
  readonly brandId: string;
  readonly otherBrandId: string;
  readonly briefIds: readonly string[];
  readonly actorId: string;
}

async function fixture(): Promise<Fixture> {
  const db = await testDb();
  const result = await seed(db);
  const briefIds = result.briefs.map((brief) => brief.id);
  const brandId = result.childBrand.id;
  return {
    db,
    brandId,
    otherBrandId: result.templateBrand.id,
    briefIds,
    actorId: result.admin.id,
  };
}

/**
 * Rewrite the seeded briefs so the stats fixture is predictable: four briefs assigned to Alice (two
 * in flight, one approved, one draft), two to Bob (both in flight), one with no assignee. Returns
 * the ids by role so the per-editor test can read them.
 */
async function withAssignments(f: Fixture): Promise<{
  readonly alice1: string;
  readonly alice2: string;
  readonly alice3: string;
  readonly bob1: string;
  readonly bob2: string;
  readonly orphan: string;
}> {
  const [alice1, alice2, alice3, aliceDraft, bob1, bob2, orphan] = f.briefIds;
  if (
    alice1 === undefined ||
    alice2 === undefined ||
    alice3 === undefined ||
    aliceDraft === undefined ||
    bob1 === undefined ||
    bob2 === undefined ||
    orphan === undefined
  ) {
    throw new Error('seed produced fewer than seven briefs');
  }
  await f.db
    .update(creativeBriefs)
    .set({ assignee: 'alice', internalStatus: 'sent_to_editor_or_designer' })
    .where(eq(creativeBriefs.id, alice1));
  await f.db
    .update(creativeBriefs)
    .set({ assignee: 'alice', internalStatus: 'ad_submitted' })
    .where(eq(creativeBriefs.id, alice2));
  await f.db
    .update(creativeBriefs)
    .set({ assignee: 'alice', internalStatus: 'approved' })
    .where(eq(creativeBriefs.id, alice3));
  await f.db
    .update(creativeBriefs)
    .set({ assignee: 'alice', internalStatus: 'draft' })
    .where(eq(creativeBriefs.id, aliceDraft));
  await f.db
    .update(creativeBriefs)
    .set({ assignee: 'bob', internalStatus: 'under_editing_or_designing' })
    .where(eq(creativeBriefs.id, bob1));
  await f.db
    .update(creativeBriefs)
    .set({ assignee: 'bob', internalStatus: 'revisions_needed' })
    .where(eq(creativeBriefs.id, bob2));
  await f.db
    .update(creativeBriefs)
    .set({ assignee: null, internalStatus: 'ad_submitted' })
    .where(eq(creativeBriefs.id, orphan));
  return { alice1, alice2, alice3, bob1, bob2, orphan };
}

async function logTransition(
  f: Fixture,
  briefId: string,
  newValue: string,
  createdAt: Date,
): Promise<void> {
  await f.db.insert(activityLog).values({
    brandId: f.brandId,
    entityType: 'creative_brief',
    entityId: briefId,
    field: 'internal_status',
    newValue,
    createdBy: f.actorId,
    updatedBy: f.actorId,
    createdAt,
    updatedAt: createdAt,
  });
}

describe('startOfWeekMonday', () => {
  it('returns Monday 00:00 of the week containing `now`', () => {
    // 2026-10-14 is a Wednesday.
    const wed = new Date('2026-10-14T15:30:00Z');
    const start = startOfWeekMonday(wed);
    // Monday 2026-10-12. Compare on calendar day in the local TZ since the function uses setDate.
    expect(start.getDay()).toBe(1);
    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
    expect(start.getSeconds()).toBe(0);
  });

  it('treats Sunday as the LAST day of the current week, not the first', () => {
    const sun = new Date('2026-10-18T10:00:00Z');
    const start = startOfWeekMonday(sun);
    expect(start.getDay()).toBe(1);
    // 2026-10-12 Monday is 6 days before 2026-10-18 Sunday.
    expect(Math.round((sun.getTime() - start.getTime()) / DAY_MS)).toBe(6);
  });
});

describe('trailingThirtyStart', () => {
  it('is exactly 30 days before now', () => {
    const now = new Date('2026-10-14T12:00:00Z');
    const start = trailingThirtyStart(now);
    expect(now.getTime() - start.getTime()).toBe(30 * DAY_MS);
  });
});

describe('briefsInFlight', () => {
  it('counts briefs in the six working statuses, ignoring draft and approved', async () => {
    const f = await fixture();
    await withAssignments(f);
    // Draft (1), approved (1), orphan ad_submitted (1), alice ad_submitted + sent_to_editor,
    // bob under_editing + revisions_needed = 5 in flight.
    await expect(briefsInFlight(f.db, f.brandId)).resolves.toBe(5);
  });

  it('counts zero when every brief is draft or approved', async () => {
    const f = await fixture();
    for (const briefId of f.briefIds) {
      await f.db
        .update(creativeBriefs)
        .set({ internalStatus: 'draft' })
        .where(eq(creativeBriefs.id, briefId));
    }
    await expect(briefsInFlight(f.db, f.brandId)).resolves.toBe(0);
  });
});

describe('approvedThisWeek', () => {
  it('counts distinct briefs transitioned to approved since Monday 00:00', async () => {
    const f = await fixture();
    const { alice3, bob1 } = await withAssignments(f);
    const now = new Date('2026-10-14T12:00:00Z');
    const monday = startOfWeekMonday(now);
    await logTransition(f, alice3, 'approved', new Date(monday.getTime() + HOUR_MS));
    // A re-approval in the same week still counts the brief once.
    await logTransition(f, alice3, 'approved', new Date(monday.getTime() + 2 * HOUR_MS));
    await logTransition(f, bob1, 'approved', new Date(monday.getTime() + 3 * HOUR_MS));
    await expect(approvedThisWeek(f.db, f.brandId, now)).resolves.toBe(2);
  });

  it('excludes transitions before the week started', async () => {
    const f = await fixture();
    const { alice3 } = await withAssignments(f);
    const now = new Date('2026-10-14T12:00:00Z');
    const monday = startOfWeekMonday(now);
    await logTransition(f, alice3, 'approved', new Date(monday.getTime() - HOUR_MS));
    await expect(approvedThisWeek(f.db, f.brandId, now)).resolves.toBe(0);
  });

  it('ignores transitions whose newValue is not approved', async () => {
    const f = await fixture();
    const { alice3 } = await withAssignments(f);
    const now = new Date('2026-10-14T12:00:00Z');
    const monday = startOfWeekMonday(now);
    await logTransition(f, alice3, 'revisions_needed', new Date(monday.getTime() + HOUR_MS));
    await expect(approvedThisWeek(f.db, f.brandId, now)).resolves.toBe(0);
  });
});

describe('avgRevisionHours', () => {
  it('returns null when no revisions_needed → revisions_submitted pairs exist in the window', async () => {
    const f = await fixture();
    await withAssignments(f);
    const now = new Date('2026-10-14T12:00:00Z');
    await expect(avgRevisionHours(f.db, f.brandId, now)).resolves.toBeNull();
  });

  it('averages the time deltas across every pair over the trailing 30 days', async () => {
    const f = await fixture();
    const { alice2, bob2 } = await withAssignments(f);
    const now = new Date('2026-10-14T12:00:00Z');
    // Pair 1: 4h (alice2). Pair 2: 10h (bob2). Average = 7.
    await logTransition(f, alice2, 'revisions_needed', new Date(now.getTime() - 10 * HOUR_MS));
    await logTransition(f, alice2, 'revisions_submitted', new Date(now.getTime() - 6 * HOUR_MS));
    await logTransition(f, bob2, 'revisions_needed', new Date(now.getTime() - 20 * HOUR_MS));
    await logTransition(f, bob2, 'revisions_submitted', new Date(now.getTime() - 10 * HOUR_MS));
    await expect(avgRevisionHours(f.db, f.brandId, now)).resolves.toBeCloseTo(7, 5);
  });

  it('includes a pair whose needed row is at 30d-1h and excludes 30d+1h', async () => {
    const f = await fixture();
    const { alice2, bob2 } = await withAssignments(f);
    const now = new Date('2026-10-14T12:00:00Z');
    // Inside the window by one hour.
    await logTransition(
      f,
      alice2,
      'revisions_needed',
      new Date(now.getTime() - (30 * DAY_MS - HOUR_MS)),
    );
    await logTransition(
      f,
      alice2,
      'revisions_submitted',
      new Date(now.getTime() - (30 * DAY_MS - 3 * HOUR_MS)), // 2h after needed.
    );
    // Outside by one hour — must not pair.
    await logTransition(
      f,
      bob2,
      'revisions_needed',
      new Date(now.getTime() - (30 * DAY_MS + HOUR_MS)),
    );
    await logTransition(
      f,
      bob2,
      'revisions_submitted',
      new Date(now.getTime() - (30 * DAY_MS + HOUR_MS - 5 * HOUR_MS)),
    );
    await expect(avgRevisionHours(f.db, f.brandId, now)).resolves.toBeCloseTo(2, 5);
  });

  it('skips unpaired revisions_needed rows', async () => {
    const f = await fixture();
    const { alice2 } = await withAssignments(f);
    const now = new Date('2026-10-14T12:00:00Z');
    // One pair of 4h plus one orphan `revisions_needed` with no follow-up.
    await logTransition(f, alice2, 'revisions_needed', new Date(now.getTime() - 10 * HOUR_MS));
    await logTransition(f, alice2, 'revisions_submitted', new Date(now.getTime() - 6 * HOUR_MS));
    await logTransition(f, alice2, 'revisions_needed', new Date(now.getTime() - 2 * HOUR_MS));
    await expect(avgRevisionHours(f.db, f.brandId, now)).resolves.toBeCloseTo(4, 5);
  });
});

describe('pairRevisionRows (pure)', () => {
  it('ties were pairs: the second needed resets, the pair after it still counts', () => {
    const now = new Date('2026-10-14T12:00:00Z');
    const start = new Date(now.getTime() - 30 * DAY_MS);
    const rows = [
      {
        entityId: 'brief-1',
        newValue: 'revisions_needed',
        createdAt: new Date(now.getTime() - 10 * HOUR_MS),
      },
      {
        entityId: 'brief-1',
        newValue: 'revisions_needed',
        createdAt: new Date(now.getTime() - 8 * HOUR_MS),
      },
      {
        entityId: 'brief-1',
        newValue: 'revisions_submitted',
        createdAt: new Date(now.getTime() - 4 * HOUR_MS),
      },
    ];
    const pairs = pairRevisionRows(rows, start);
    expect(pairs).toHaveLength(1);
    expect((pairs[0]?.submittedAt ?? 0) - (pairs[0]?.neededAt ?? 0)).toBe(4 * HOUR_MS);
  });
});

describe('qaPassRatePct', () => {
  it('returns null when no brief reached submission in the trailing 30 days', async () => {
    const f = await fixture();
    await withAssignments(f);
    const now = new Date('2026-10-14T12:00:00Z');
    await expect(qaPassRatePct(f.db, f.brandId, now)).resolves.toBeNull();
  });

  it('returns 100 when every brief that reached submission ended approved', async () => {
    const f = await fixture();
    const { alice1, alice2 } = await withAssignments(f);
    const now = new Date('2026-10-14T12:00:00Z');
    const t = (hoursAgo: number): Date => new Date(now.getTime() - hoursAgo * HOUR_MS);
    await logTransition(f, alice1, 'ad_submitted', t(72));
    await logTransition(f, alice1, 'approved', t(48));
    await logTransition(f, alice2, 'ad_submitted', t(24));
    await logTransition(f, alice2, 'approved', t(12));
    await expect(qaPassRatePct(f.db, f.brandId, now)).resolves.toBeCloseTo(100, 5);
  });

  it('is approved briefs over briefs that reached submission in the window', async () => {
    const f = await fixture();
    const { alice1, alice2, bob1 } = await withAssignments(f);
    const now = new Date('2026-10-14T12:00:00Z');
    const t = (hoursAgo: number): Date => new Date(now.getTime() - hoursAgo * HOUR_MS);
    await logTransition(f, alice1, 'ad_submitted', t(72));
    await logTransition(f, alice1, 'approved', t(48));
    await logTransition(f, alice2, 'ad_submitted', t(72));
    await logTransition(f, bob1, 'revisions_needed', t(48));
    // 1 approved / 3 reached = 33.33…%
    await expect(qaPassRatePct(f.db, f.brandId, now)).resolves.toBeCloseTo(100 / 3, 5);
  });
});

describe('perEditorBars', () => {
  it('groups the three categories per editor and omits unassigned briefs', async () => {
    const f = await fixture();
    await withAssignments(f);
    const bars = await perEditorBars(f.db, f.brandId);
    expect(bars).toHaveLength(2);
    const alice = bars.find((row) => row.editor === 'alice');
    const bob = bars.find((row) => row.editor === 'bob');
    expect(alice).toEqual({ editor: 'alice', assigned: 1, inReview: 1, approved: 1 });
    expect(bob).toEqual({ editor: 'bob', assigned: 1, inReview: 1, approved: 0 });
  });

  it('sorts editors by total descending with name as tiebreaker', async () => {
    const f = await fixture();
    const { alice1, alice2, alice3, bob1, bob2 } = await withAssignments(f);
    // Give Bob three briefs by reassigning one of Alice's.
    await f.db.update(creativeBriefs).set({ assignee: 'bob' }).where(eq(creativeBriefs.id, alice1));
    const bars = await perEditorBars(f.db, f.brandId);
    expect(bars.map((row) => row.editor)).toEqual(['bob', 'alice']);
    // Silence the destructured ids the branch doesn't use directly.
    expect([alice2, alice3, bob1, bob2].every((id) => typeof id === 'string')).toBe(true);
  });
});

describe('weeklyOutput', () => {
  it('returns seven points Mon..Sun with zero counts when no submission is in the week', async () => {
    const f = await fixture();
    const now = new Date('2026-10-14T12:00:00Z');
    const points = await weeklyOutput(f.db, f.brandId, now);
    expect(points).toHaveLength(7);
    expect(points.map((p) => p.day)).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
    expect(points.every((p) => p.count === 0)).toBe(true);
  });

  it('counts current submissions bucketed by weekday', async () => {
    const f = await fixture();
    const { alice1, bob1 } = await withAssignments(f);
    const now = new Date('2026-10-14T12:00:00Z');
    const monday = startOfWeekMonday(now);
    // Submission on Monday + Wednesday.
    await f.db.insert(briefSubmissions).values([
      {
        briefId: alice1,
        version: 1,
        uploadedBy: f.actorId,
        fileUrl: 'https://cdn.example/a.mp4',
        fileType: 'video/mp4',
        thumbnailUrl: null,
        durationSeconds: null,
        isCurrent: true,
        uploadedAt: new Date(monday.getTime() + 2 * HOUR_MS),
      },
      {
        briefId: bob1,
        version: 1,
        uploadedBy: f.actorId,
        fileUrl: 'https://cdn.example/b.mp4',
        fileType: 'video/mp4',
        thumbnailUrl: null,
        durationSeconds: null,
        isCurrent: true,
        uploadedAt: new Date(monday.getTime() + 2 * DAY_MS + 4 * HOUR_MS),
      },
    ]);
    const points = await weeklyOutput(f.db, f.brandId, now);
    expect(points[0]?.count).toBe(1); // Mon
    expect(points[2]?.count).toBe(1); // Wed
    expect(points[1]?.count).toBe(0);
  });

  it('ignores historical submissions (is_current = false)', async () => {
    const f = await fixture();
    const { alice1 } = await withAssignments(f);
    const now = new Date('2026-10-14T12:00:00Z');
    const monday = startOfWeekMonday(now);
    await f.db.insert(briefSubmissions).values({
      briefId: alice1,
      version: 1,
      uploadedBy: f.actorId,
      fileUrl: 'https://cdn.example/a.mp4',
      fileType: 'video/mp4',
      thumbnailUrl: null,
      durationSeconds: null,
      isCurrent: false,
      uploadedAt: new Date(monday.getTime() + HOUR_MS),
    });
    const points = await weeklyOutput(f.db, f.brandId, now);
    expect(points.every((p) => p.count === 0)).toBe(true);
  });
});

describe('turnaroundTable', () => {
  it('is empty when no pairs exist', async () => {
    const f = await fixture();
    await withAssignments(f);
    const now = new Date('2026-10-14T12:00:00Z');
    await expect(turnaroundTable(f.db, f.brandId, now)).resolves.toEqual([]);
  });

  it('reports per editor per type the average hours of each pair', async () => {
    const f = await fixture();
    const { alice2, bob2 } = await withAssignments(f);
    // Make the two briefs' types explicit so the table columns are populated predictably.
    await f.db.update(creativeBriefs).set({ type: 'Video' }).where(eq(creativeBriefs.id, alice2));
    await f.db.update(creativeBriefs).set({ type: 'Static' }).where(eq(creativeBriefs.id, bob2));
    const now = new Date('2026-10-14T12:00:00Z');
    await logTransition(f, alice2, 'revisions_needed', new Date(now.getTime() - 8 * HOUR_MS));
    await logTransition(f, alice2, 'revisions_submitted', new Date(now.getTime() - 2 * HOUR_MS));
    await logTransition(f, bob2, 'revisions_needed', new Date(now.getTime() - 15 * HOUR_MS));
    await logTransition(f, bob2, 'revisions_submitted', new Date(now.getTime() - 5 * HOUR_MS));
    const rows = await turnaroundTable(f.db, f.brandId, now);
    const alice = rows.find((row) => row.editor === 'alice');
    const bob = rows.find((row) => row.editor === 'bob');
    expect(alice?.perType.Video).toBeCloseTo(6, 5);
    expect(alice?.perType.Static).toBeNull();
    expect(bob?.perType.Static).toBeCloseTo(10, 5);
    expect(bob?.perType.Video).toBeNull();
  });
});

describe('loadBriefStats', () => {
  it('shapes the result the UI reads: kpi, perEditor, weeklyOutput, turnaround', async () => {
    const f = await fixture();
    await withAssignments(f);
    const now = new Date('2026-10-14T12:00:00Z');
    const stats = await loadBriefStats(f.db, f.brandId, now);
    expect(Object.keys(stats.kpi).sort()).toEqual([
      'approvedThisWeek',
      'avgRevisionHours',
      'inFlight',
      'qaPassRatePct',
    ]);
    expect(stats.weeklyOutput).toHaveLength(7);
    expect(stats.perEditor.length).toBeGreaterThan(0);
    expect(stats.turnaround).toEqual([]);
  });
});
