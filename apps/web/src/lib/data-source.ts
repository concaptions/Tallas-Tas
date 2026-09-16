import {
  DEMO_BRAND_ID,
  angles,
  brands,
  concepts,
  createNeonDb,
  demoAngles,
  demoConcepts,
  demoPersonas,
  demoThemes,
  listPersonas,
  themes,
  type NeonDb,
  type PersonaListRow,
} from '@tas/db';
import { serverEnv } from '@tas/env';

import { DEMO_MUTATION_REFUSED, isDemoMode } from './demo-mode';

/**
 * The one place the app decides where its data comes from.
 *
 * DEMO MODE (no Clerk publishable key): the in-repo fixtures from `@tas/db`, and NOT the database —
 * `withDb()` is never reached, even with `DATABASE_URL` set. That is the half of the demo-mode rule
 * that makes an unauthenticated visitor safe, because the middleware lets every route through.
 *
 * LIVE MODE (Clerk configured): Neon, through `createNeonDb`. The connection is opened per call and
 * closed in a `finally`; no module-level singleton (CLAUDE.md, "No shared mutable module state").
 *
 * The fixtures and a seeded database are row-for-row identical, ids included (`seed(db)` writes the
 * same rows into a child brand whose id is `DEMO_BRAND_ID`), so a page renders one branch either way.
 */
export interface BrandSummary {
  readonly id: string;
  readonly name: string;
  readonly status: string;
}

export interface SectionCounts {
  readonly personas: number;
  readonly angles: number;
  readonly themes: number;
  readonly concepts: number;
}

export interface Overview {
  readonly brand: BrandSummary | null;
  readonly counts: SectionCounts;
}

/** The brand the demo fixtures belong to. `seed(db)` gives the seeded child brand this exact id. */
const DEMO_BRAND: BrandSummary = {
  id: DEMO_BRAND_ID,
  name: 'Niagara Sleep Solutions',
  status: 'active',
};

const EMPTY_COUNTS: SectionCounts = { personas: 0, angles: 0, themes: 0, concepts: 0 };

/** Opens a Neon connection, runs `query`, and always closes the pool. Live mode only. */
async function withDb<T>(query: (db: NeonDb) => Promise<T>): Promise<T> {
  const db = createNeonDb(serverEnv().DATABASE_URL);
  try {
    return await query(db);
  } finally {
    await db.$client.end();
  }
}

/** A live row is current when it has not been soft deleted. Soft delete only, never `DELETE FROM`. */
function isLive(row: { deletedAt: Date | null }): boolean {
  return row.deletedAt === null;
}

/**
 * The working brand. Live mode picks the first client workspace (never the parent template), which
 * is all a single-brand V0 shell needs; brand selection per membership arrives with the switcher.
 */
async function liveBrand(db: NeonDb): Promise<BrandSummary | null> {
  const rows = await db.select().from(brands);
  const brand = rows.filter(isLive).find((row) => !row.isTemplate) ?? null;
  return brand === null ? null : { id: brand.id, name: brand.name, status: brand.status };
}

/**
 * Heading and card counts for the shell and the Overview page, in one round trip in live mode.
 * `themes` is the GLOBAL library (non-negotiable 3), so it is counted across brands, not scoped.
 */
export async function loadOverview(): Promise<Overview> {
  if (isDemoMode()) {
    return {
      brand: DEMO_BRAND,
      counts: {
        personas: demoPersonas.length,
        angles: demoAngles.length,
        themes: demoThemes.length,
        concepts: demoConcepts.length,
      },
    };
  }

  return withDb(async (db) => {
    const brand = await liveBrand(db);
    if (brand === null) {
      return { brand, counts: EMPTY_COUNTS };
    }
    const scoped = (rows: { brandId: string | null; deletedAt: Date | null }[]) =>
      rows.filter((row) => isLive(row) && row.brandId === brand.id).length;

    const [personaRows, angleRows, themeRows, conceptRows] = await Promise.all([
      listPersonas(db, brand.id),
      db.select().from(angles),
      db.select().from(themes),
      db.select().from(concepts),
    ]);

    return {
      brand,
      counts: {
        personas: personaRows.length,
        angles: scoped(angleRows),
        themes: themeRows.filter(isLive).length,
        concepts: scoped(conceptRows),
      },
    };
  });
}

/** Just the brand, for the shell's top bar. */
export async function currentBrand(): Promise<BrandSummary | null> {
  if (isDemoMode()) {
    return DEMO_BRAND;
  }
  return withDb(liveBrand);
}

/**
 * Every persona of the working brand, in `updated_at` order, already carrying `productName`. The
 * Personas page calls this and nothing else; it never opens a connection of its own.
 */
export async function listPersonaRows(): Promise<PersonaListRow[]> {
  if (isDemoMode()) {
    return demoPersonas;
  }
  return withDb(async (db) => {
    const brand = await liveBrand(db);
    return brand === null ? [] : listPersonas(db, brand.id);
  });
}

/**
 * Every mutation calls this first. In demo mode there is no database and no actor, so the write is
 * refused with a message the UI shows rather than failing silently.
 */
export function assertWritable(): void {
  if (isDemoMode()) {
    throw new Error(DEMO_MUTATION_REFUSED);
  }
}
