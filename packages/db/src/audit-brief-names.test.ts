import { describe, expect, it } from 'vitest';

import { auditBriefNames, type BriefNameRow } from './audit-brief-names';
import { insertBrief } from './briefs';
import { DEMO_BRAND_ID } from './demo-data';
import { seed } from './seed';
import { testDb } from './testing';

const ACTOR = 'user_2TESTACTOR';

/**
 * Ticket 3 (Oct 14) — the audit function runs end-to-end on a PGlite fixture: it counts briefs
 * by `name_mode` and reports every row whose stored name does NOT match the formula the caller
 * supplies. `@tas/db` does not depend on `@tas/domain` (the dependency edge is app → db, app →
 * domain, never db → domain — the comment at `briefs.test.ts:313` pins that), so the real
 * formula is injected by the `.mjs` wrapper and by callers in `apps/web`; here we inject a
 * stand-in to prove the audit's SHAPE: counts come back, and a planted drift is reported.
 */
function stub(prefix: string): (row: BriefNameRow) => string {
  // A deterministic one-liner tied to the row's number, so a drifted stored name mismatches it.
  return (row) => `${prefix}_${String(row.briefNumber ?? 0)}`;
}

describe('auditBriefNames', () => {
  it('runs against a seeded fixture and returns both the counts and the gap list', async () => {
    const db = await testDb();
    await seed(db);

    const audit = await auditBriefNames(db, stub('EXPECTED'));

    expect(Array.isArray(audit.countsByMode)).toBe(true);
    expect(Array.isArray(audit.gaps)).toBe(true);
    expect(audit.countsByMode.length).toBeGreaterThan(0);
    for (const row of audit.countsByMode) {
      expect(['auto', 'manual']).toContain(row.nameMode);
      expect(row.briefs).toBeGreaterThanOrEqual(0);
    }
  });

  it('flags an auto-named row whose stored name does not match the injected formula', async () => {
    const db = await testDb();
    await seed(db);

    const drifted = await insertBrief(
      db,
      DEMO_BRAND_ID,
      {
        name: 'drifted-name',
        nameMode: 'auto',
        briefNumber: 42,
        source: 'TAS',
        funnel: 'TOF',
        type: 'Video',
        batch: 'B1',
      },
      ACTOR,
    );

    const audit = await auditBriefNames(db, stub('EXPECTED'));
    const gap = audit.gaps.find((row) => row.id === drifted.id);
    expect(gap).toBeDefined();
    expect(gap?.stored).toBe('drifted-name');
    expect(gap?.expected).toBe('EXPECTED_42');
  });
});
