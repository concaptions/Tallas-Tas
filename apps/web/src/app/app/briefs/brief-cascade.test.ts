import {
  getBriefById,
  insertBrief,
  insertConcept,
  listBriefsByConceptId,
  renameBrief,
  seed,
} from '@tas/db';
import { testDb, type PgliteDb } from '@tas/db/testing';
import { creativeNameForConcept } from '@tas/domain/creatives';
import { describe, expect, it } from 'vitest';

/**
 * The concept → brief rename cascade the Concepts Server Action composes (`concepts/actions.ts`):
 * when a concept's name changes, every brief that carries it has its PRD §7 name recomputed with the
 * pure `creativeNameForConcept` and rewritten with `renameBrief`, all inside `withBrand`. This
 * exercises the real three-part composition (db read → domain formula → db write) against a PGlite
 * database, because `@tas/db` cannot import `@tas/domain` — only `apps/web`, which owns the cascade,
 * sees both layers.
 *
 * There is no angle → concept or theme → concept cascade in the codebase, so none is tested: the
 * single cascade is concept name → brief name.
 */

const ACTOR = 'user_strategist';

async function seedBrand(): Promise<{ db: PgliteDb; brandId: string; otherBrandId: string }> {
  const db = await testDb();
  const { childBrand, templateBrand } = await seed(db);
  return { db, brandId: childBrand.id, otherBrandId: templateBrand.id };
}

async function insertLinkedBrief(
  db: PgliteDb,
  brandId: string,
  conceptId: string,
  fields: { name: string; funnel: 'TOF' | 'Retargeting'; sequence: number; version: number },
) {
  return insertBrief(
    db,
    brandId,
    {
      conceptId,
      name: fields.name,
      batch: 'B1',
      funnel: fields.funnel,
      type: 'Video',
      sequence: fields.sequence,
      version: fields.version,
    },
    ACTOR,
  );
}

/** Run the exact cascade the Server Action runs when a concept's name changes. */
async function cascadeRename(
  db: PgliteDb,
  brandId: string,
  conceptId: string,
  newName: string,
  batch: string,
): Promise<void> {
  const conceptRow = { name: newName, batch };
  const briefs = await listBriefsByConceptId(db, brandId, conceptId);
  await Promise.all(
    briefs.map((brief) => {
      const newBriefName = creativeNameForConcept(conceptRow, {
        source: brief.source,
        funnel: brief.funnel,
        format: brief.type,
        number: brief.sequence,
        version: brief.version,
        batch,
        product: null,
      });
      return renameBrief(db, brandId, brief.id, newBriefName, ACTOR);
    }),
  );
}

async function nameOf(db: PgliteDb, brandId: string, id: string): Promise<string> {
  const row = await getBriefById(db, brandId, id);
  if (row === null) throw new Error('brief gone');
  return row.name;
}

describe('concept → brief rename cascade', () => {
  it('recomputes every linked brief name from the new concept segment, keeping the §7 prefix', async () => {
    const { db, brandId } = await seedBrand();
    const concept = await insertConcept(
      db,
      brandId,
      { name: 'B1-Old Angle-Old Theme', batch: 'B1' },
      ACTOR,
    );
    const a = await insertLinkedBrief(db, brandId, concept.id, {
      name: 'TAS-TV1-B1-Old Angle-Old Theme-V1',
      funnel: 'TOF',
      sequence: 1,
      version: 1,
    });
    const b = await insertLinkedBrief(db, brandId, concept.id, {
      name: 'TAS-RV2-B1-Old Angle-Old Theme-V3',
      funnel: 'Retargeting',
      sequence: 2,
      version: 3,
    });

    await cascadeRename(db, brandId, concept.id, 'B1-New Angle-New Theme', 'B1');

    // Both carry the new Angle-Theme segment, each keeping its own funnel/number/version.
    expect(await nameOf(db, brandId, a.id)).toBe('TAS-TV1-B1-New Angle-New Theme-V1');
    expect(await nameOf(db, brandId, b.id)).toBe('TAS-RV2-B1-New Angle-New Theme-V3');
  });

  it('never touches a standalone brief (no concept) or a brief of another concept', async () => {
    const { db, brandId } = await seedBrand();
    const concept = await insertConcept(
      db,
      brandId,
      { name: 'B1-Angle-Theme', batch: 'B1' },
      ACTOR,
    );
    const linked = await insertLinkedBrief(db, brandId, concept.id, {
      name: 'TAS-TV1-B1-Angle-Theme-V1',
      funnel: 'TOF',
      sequence: 1,
      version: 1,
    });
    // A standalone static, no concept, with a valid §7 name that must survive untouched.
    const standalone = await insertBrief(
      db,
      brandId,
      {
        name: 'TAS-TS1-B4-Standalone-V1',
        batch: 'B4',
        funnel: 'TOF',
        type: 'Static',
        sequence: 1,
        version: 1,
      },
      ACTOR,
    );

    await cascadeRename(db, brandId, concept.id, 'B1-Renamed-Theme', 'B1');

    expect(await nameOf(db, brandId, linked.id)).toBe('TAS-TV1-B1-Renamed-Theme-V1');
    // The standalone is not in the concept's brief list, so its name is untouched.
    expect(await nameOf(db, brandId, standalone.id)).toBe('TAS-TS1-B4-Standalone-V1');
  });

  it('stays inside the brand: the same concept id under another brand is not reached', async () => {
    const { db, brandId, otherBrandId } = await seedBrand();
    const concept = await insertConcept(
      db,
      brandId,
      { name: 'B1-Angle-Theme', batch: 'B1' },
      ACTOR,
    );
    const mine = await insertLinkedBrief(db, brandId, concept.id, {
      name: 'TAS-TV1-B1-Angle-Theme-V1',
      funnel: 'TOF',
      sequence: 1,
      version: 1,
    });

    // Listing under the WRONG brand returns nothing, so the cascade is a no-op there.
    const strangers = await listBriefsByConceptId(db, otherBrandId, concept.id);
    expect(strangers).toHaveLength(0);

    // And a direct renameBrief with the wrong brand cannot rewrite my row.
    await renameBrief(db, otherBrandId, mine.id, 'HIJACKED', ACTOR);
    expect(await nameOf(db, brandId, mine.id)).toBe('TAS-TV1-B1-Angle-Theme-V1');
  });
});
