import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { getBriefById, insertBrief, renameBrief } from './briefs';
import { DEMO_BRAND_ID } from './demo-data';
import { creativeBriefs } from './schema';
import { seed } from './seed';
import { testDb, type PgliteDb } from './testing';

/**
 * `creative_briefs.name_mode` (migration 0060, 2026-10-09): a name is rewritten ONLY when the row
 * says `auto`. An imported or hand-typed name is `manual` — the column default every existing row
 * kept — and survives every concept rename at the query layer, whatever the action above decides.
 */
const ACTOR = 'user_2TESTACTOR';

async function freshDb(): Promise<PgliteDb> {
  const db = await testDb();
  await seed(db);
  return db;
}

describe('name_mode', () => {
  it('defaults to manual, so an imported brief is protected without the importer knowing the column', async () => {
    const db = await freshDb();

    const imported = await insertBrief(
      db,
      DEMO_BRAND_ID,
      { name: 'VID001-B1-Pain', legacyAirtableId: 'recIMPORTED' },
      ACTOR,
    );

    expect(imported.nameMode).toBe('manual');
  });

  it('rejects anything but auto or manual at the database', async () => {
    const db = await freshDb();

    // Drizzle wraps the driver error, so the constraint name is on the cause, not the message.
    const failure = await insertBrief(
      db,
      DEMO_BRAND_ID,
      { name: 'x', nameMode: 'formula' as unknown as 'auto' },
      ACTOR,
    ).then(
      () => null,
      (error: unknown) => error,
    );
    expect(failure).toBeInstanceOf(Error);
    const cause = (failure as Error).cause;
    expect(String(cause instanceof Error ? cause.message : failure)).toMatch(
      /creative_briefs_name_mode_check/,
    );
  });
});

describe('renameBrief', () => {
  it('leaves an imported or hand-typed name (manual) untouched after a concept rename', async () => {
    const db = await freshDb();
    const imported = await insertBrief(
      db,
      DEMO_BRAND_ID,
      { name: 'VID001-B1-Pain', legacyAirtableId: 'recIMPORTED' },
      ACTOR,
    );

    await renameBrief(db, DEMO_BRAND_ID, imported.id, 'TAS-TV1-B9-Pain-UGC-V1', ACTOR);

    const after = await getBriefById(db, DEMO_BRAND_ID, imported.id);
    expect(after?.name).toBe('VID001-B1-Pain');
  });

  it('renames a brief the formula owns (auto)', async () => {
    const db = await freshDb();
    const auto = await insertBrief(
      db,
      DEMO_BRAND_ID,
      { name: 'TAS-TOF-V001-Pain-UGC-B1', briefNumber: 1, nameMode: 'auto' },
      ACTOR,
    );

    await renameBrief(db, DEMO_BRAND_ID, auto.id, 'TAS-TOF-V001-Pain-UGC-B9', ACTOR);

    const [after] = await db.select().from(creativeBriefs).where(eq(creativeBriefs.id, auto.id));
    expect(after?.name).toBe('TAS-TOF-V001-Pain-UGC-B9');
    expect(after?.updatedBy).toBe(ACTOR);
  });
});
