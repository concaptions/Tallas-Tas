import { and, eq, isNull } from 'drizzle-orm';

import type { Creator } from './schema';
import { creators } from './schema';
import type { Db } from './db';
import { fireNotification } from './notification-dispatch';
import { withBrand } from './tenancy';

/**
 * Cross-brand partnership scanner and single-row mutations for the scheduled alert job.
 *
 * The scanner queries (`getExpiringPartnerships`, `getPartnershipsDueForRenewal`) run as a system-level
 * cron across ALL brands, so they use direct Drizzle with `deleted_at IS NULL` rather than `withBrand`.
 * This is the one place in `@tas/db` where a branded table is read without the brand scope, and it is
 * deliberate: the job must discover every expiring partnership in the platform regardless of which brand
 * it belongs to, and `withBrand` would require iterating through every brand first — an N+1 on a table
 * the job already has a targeted index for.
 *
 * The mutations (`markSlackNotified`, `renewPartnership`) DO go through `withBrand`: the scanner has
 * already resolved each creator's `brandId`, so the write path keeps the tenancy enforcement.
 *
 * EXPIRY ARITHMETIC is replicated here as inline constants, mirroring the pure functions in
 * `@tas/domain/creators/partnership-expiry` (`partnershipExpiresOn`, `daysUntilPartnershipExpiry`).
 * `@tas/db` cannot import from `@tas/domain` (the dependency edge runs the other way), and the
 * arithmetic is three lines: `effectiveStart + (periodDays + ext) * DAY_MS`. The domain owns the
 * constants; the caller passes `reminderDays` so the two packages never disagree on a threshold.
 */

const DAY_MS = 86_400_000;

interface ScannerOptions {
  readonly now: Date;
  readonly reminderDays: number;
}

function effectiveExpiry(row: Creator): number | null {
  const start = row.currentPeriodStart ?? row.partnershipActivatedAt;
  if (!start || !row.partnershipPeriodDays) return null;
  const ext = row.currentPeriodStart ? 0 : row.extensionDays;
  return start.getTime() + (row.partnershipPeriodDays + ext) * DAY_MS;
}

/**
 * Active partnerships within `reminderDays` of expiring that haven't been Slack-notified yet.
 * The scheduled scanner calls this, passing `PARTNERSHIP_REMINDER_DAYS` from `@tas/domain`.
 */
export async function getExpiringPartnerships(db: Db, opts: ScannerOptions): Promise<Creator[]> {
  const candidates = await db
    .select()
    .from(creators)
    .where(
      and(
        eq(creators.partnershipActivity, 'active'),
        eq(creators.forPartnershipAds, true),
        eq(creators.slackNotified, false),
        isNull(creators.deletedAt),
      ),
    );

  return candidates.filter((row) => {
    const expiresAt = effectiveExpiry(row);
    if (expiresAt === null) return false;
    const daysRemaining = Math.floor((expiresAt - opts.now.getTime()) / DAY_MS);
    return daysRemaining >= 0 && daysRemaining <= opts.reminderDays;
  });
}

/**
 * Active partnerships that have expired AND `continueWorkingWith = true`: ready for auto-renewal.
 */
export async function getPartnershipsDueForRenewal(db: Db, now: Date): Promise<Creator[]> {
  const candidates = await db
    .select()
    .from(creators)
    .where(
      and(
        eq(creators.partnershipActivity, 'active'),
        eq(creators.forPartnershipAds, true),
        eq(creators.continueWorkingWith, true),
        isNull(creators.deletedAt),
      ),
    );

  return candidates.filter((row) => {
    const expiresAt = effectiveExpiry(row);
    if (expiresAt === null) return false;
    return expiresAt <= now.getTime();
  });
}

/**
 * Active partnerships that have expired AND `continueWorkingWith = false`: the brand said "no", so
 * the window is allowed to lapse and the partnership auto-ends. Excludes rows already ended (a
 * non-null `partnership_ended_at`), so a run is idempotent.
 */
export async function getPartnershipsToEnd(db: Db, now: Date): Promise<Creator[]> {
  const candidates = await db
    .select()
    .from(creators)
    .where(
      and(
        eq(creators.partnershipActivity, 'active'),
        eq(creators.forPartnershipAds, true),
        eq(creators.continueWorkingWith, false),
        isNull(creators.partnershipEndedAt),
        isNull(creators.deletedAt),
      ),
    );

  return candidates.filter((row) => {
    const expiresAt = effectiveExpiry(row);
    if (expiresAt === null) return false;
    return expiresAt <= now.getTime();
  });
}

/**
 * Active partnerships that have expired with `continueWorkingWith` STILL NULL: nobody decided whether
 * to continue and the window has lapsed. These need a human. Excludes rows already flagged, so a run
 * is idempotent.
 */
export async function getUndecidedPastDeadline(db: Db, now: Date): Promise<Creator[]> {
  const candidates = await db
    .select()
    .from(creators)
    .where(
      and(
        eq(creators.partnershipActivity, 'active'),
        eq(creators.forPartnershipAds, true),
        isNull(creators.continueWorkingWith),
        eq(creators.requiresAttention, false),
        isNull(creators.deletedAt),
      ),
    );

  return candidates.filter((row) => {
    const expiresAt = effectiveExpiry(row);
    if (expiresAt === null) return false;
    return expiresAt <= now.getTime();
  });
}

/**
 * Marks a creator's partnership as Slack-notified so the scanner does not re-alert.
 * Uses `withBrand` — the scanner already resolved the creator's `brandId`.
 */
export async function markSlackNotified(db: Db, brandId: string, creatorId: string): Promise<void> {
  await withBrand(db, brandId).update(
    creators,
    { slackNotified: true, updatedAt: new Date() },
    eq(creators.id, creatorId),
  );
}

export const SYSTEM_ACTOR = 'system';

/**
 * Renews a partnership: resets `currentPeriodStart` to today, clears `slackNotified`, and — when the
 * creator has `extensionDays > 0` — adopts that as the new `partnershipPeriodDays`.
 */
export async function renewPartnership(
  db: Db,
  brandId: string,
  creatorId: string,
  now: Date,
): Promise<Creator | null> {
  const [current] = await withBrand(db, brandId)
    .select(creators, eq(creators.id, creatorId))
    .limit(1);

  if (!current) return null;

  const newPeriod =
    current.extensionDays > 0 ? current.extensionDays : current.partnershipPeriodDays;

  const [renewed] = await withBrand(db, brandId)
    .update(
      creators,
      {
        currentPeriodStart: now,
        slackNotified: false,
        partnershipPeriodDays: newPeriod,
        updatedAt: now,
      },
      eq(creators.id, creatorId),
    )
    .returning();

  return renewed ?? null;
}

/**
 * Ends a partnership: `partnership_activity` moves to `ended`, `partnership_ended_at` is stamped, and
 * any attention flag is cleared (a decided, ended partnership no longer needs chasing).
 */
export async function endPartnership(
  db: Db,
  brandId: string,
  creatorId: string,
  now: Date,
): Promise<Creator | null> {
  const [ended] = await withBrand(db, brandId)
    .update(
      creators,
      {
        partnershipActivity: 'ended',
        partnershipEndedAt: now,
        requiresAttention: false,
        updatedAt: now,
      },
      eq(creators.id, creatorId),
    )
    .returning();

  return ended ?? null;
}

/**
 * Raises the attention flag on an undecided, lapsed partnership so the UGC page can surface it. Does
 * not touch the partnership's activity — the decision is still open, it is only overdue.
 */
export async function flagRequiresAttention(
  db: Db,
  brandId: string,
  creatorId: string,
  now: Date,
): Promise<void> {
  await withBrand(db, brandId).update(
    creators,
    { requiresAttention: true, updatedAt: now },
    eq(creators.id, creatorId),
  );
}

export interface ScanResult {
  readonly notified: string[];
  readonly renewed: string[];
  /** Creator ids whose partnership auto-ended because the brand said "no" and the window lapsed. */
  readonly ended: string[];
  /** Creator ids flagged because the window lapsed with no continue/stop decision. */
  readonly flagged: string[];
}

/**
 * The scheduled job entry point. Finds expiring partnerships, dispatches `partnership_expiring`
 * notifications, marks each as notified, then auto-renews any expired partnerships where the
 * brand said `continueWorkingWith = true`. Returns the IDs of creators touched.
 *
 * Designed to be called by an Inngest cron or any other scheduler. The `reminderDays` parameter
 * should be `PARTNERSHIP_REMINDER_DAYS` from `@tas/domain` (25), passed by the caller so the
 * two packages never disagree on a threshold.
 */
export async function runPartnershipScanner(db: Db, opts: ScannerOptions): Promise<ScanResult> {
  const expiring = await getExpiringPartnerships(db, opts);
  const notified: string[] = [];

  for (const creator of expiring) {
    const daysLeft = daysRemaining(creator, opts.now);
    const handle = creator.instagramUsername ?? creator.name;
    const label =
      daysLeft === 0
        ? 'expires today'
        : `expires in ${String(daysLeft)} day${daysLeft === 1 ? '' : 's'}`;

    await fireNotification(db, creator.brandId, SYSTEM_ACTOR, {
      triggerKey: 'partnership_expiring',
      brandId: creator.brandId,
      subjectType: 'Partnership',
      subjectName: `${handle} ${label}`,
      actorName: 'System',
      deepLink: `/app/ugc?creator=${creator.id}`,
    });

    await markSlackNotified(db, creator.brandId, creator.id);
    notified.push(creator.id);
  }

  const dueRenewal = await getPartnershipsDueForRenewal(db, opts.now);
  const renewed: string[] = [];

  for (const creator of dueRenewal) {
    const result = await renewPartnership(db, creator.brandId, creator.id, opts.now);
    if (result) renewed.push(creator.id);
  }

  // The brand said "no": end the partnership when its window lapses, and tell the team it closed.
  // The alert reuses the `partnership_expiring` trigger for ROUTING (PRD §12 is sealed at eight
  // triggers, so there is no `partnership_ended` key); the subject line carries the real event, and
  // docs/decisions.md records that a dedicated trigger is the follow-up when §12 is extended.
  const toEnd = await getPartnershipsToEnd(db, opts.now);
  const ended: string[] = [];

  for (const creator of toEnd) {
    const result = await endPartnership(db, creator.brandId, creator.id, opts.now);
    if (!result) continue;
    const handle = creator.instagramUsername ?? creator.name;
    await fireNotification(db, creator.brandId, SYSTEM_ACTOR, {
      triggerKey: 'partnership_expiring',
      brandId: creator.brandId,
      subjectType: 'Partnership',
      subjectName: `${handle} — partnership ended`,
      actorName: 'System',
      deepLink: `/app/ugc?creator=${creator.id}`,
    });
    ended.push(creator.id);
  }

  // Nobody decided and the window has lapsed: flag it for a human and alert (same trigger reuse).
  const undecided = await getUndecidedPastDeadline(db, opts.now);
  const flagged: string[] = [];

  for (const creator of undecided) {
    await flagRequiresAttention(db, creator.brandId, creator.id, opts.now);
    const handle = creator.instagramUsername ?? creator.name;
    await fireNotification(db, creator.brandId, SYSTEM_ACTOR, {
      triggerKey: 'partnership_expiring',
      brandId: creator.brandId,
      subjectType: 'Partnership',
      subjectName: `${handle} — needs a continue/stop decision`,
      actorName: 'System',
      deepLink: `/app/ugc?creator=${creator.id}`,
    });
    flagged.push(creator.id);
  }

  return { notified, renewed, ended, flagged };
}

function daysRemaining(creator: Creator, now: Date): number {
  const expiresAt = effectiveExpiry(creator);
  if (expiresAt === null) return 0;
  return Math.max(0, Math.floor((expiresAt - now.getTime()) / DAY_MS));
}
