import { eq } from 'drizzle-orm';
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core';

import type { Db } from './db';
import {
  anglePersonas,
  angleProducts,
  angles,
  conceptAngles,
  concepts,
  creatorConcepts,
  creatorProducts,
  creators,
  personas,
  products,
} from './schema';
import { withBrand } from './tenancy';

/**
 * Two-way link writes (Sprint 9, LINK-01). One function for every link: it takes the junction and
 * which of its two sides the source id is on (`@tas/domain`'s `LINK_REGISTRY` names both for a link
 * kind; this package stays free of the domain package, so the spec is plain strings here), finds
 * the table and its columns, and replaces that side's rows — the SAME rows the other side reads, so
 * a creator linked from a concept and a concept linked from a creator are one `creator_concepts`
 * pair. No copy of a link is ever stored on a record. The caller (the Server Action) proves the
 * source row belongs to the actor's brand before calling; junction tables carry no `brand_id`.
 */
export type LinkTable = 'concept' | 'angle' | 'creator' | 'product' | 'persona';

export type LinkJunction =
  'concept_angles' | 'creator_concepts' | 'creator_products' | 'angle_products' | 'angle_personas';

/** One direction of one junction: the table the source id is on, and the table the ids are on. */
export interface LinkSpec {
  readonly junction: LinkJunction;
  readonly source: LinkTable;
  readonly target: LinkTable;
}

interface JunctionSide {
  readonly column: PgColumn;
  /** The Drizzle key of that column, for an insert value. */
  readonly key: string;
}

interface Junction {
  readonly table: PgTable;
  readonly sides: Partial<Readonly<Record<LinkTable, JunctionSide>>>;
}

const JUNCTIONS: Readonly<Record<LinkJunction, Junction>> = {
  concept_angles: {
    table: conceptAngles,
    sides: {
      concept: { column: conceptAngles.conceptId, key: 'conceptId' },
      angle: { column: conceptAngles.angleId, key: 'angleId' },
    },
  },
  creator_concepts: {
    table: creatorConcepts,
    sides: {
      creator: { column: creatorConcepts.creatorId, key: 'creatorId' },
      concept: { column: creatorConcepts.conceptId, key: 'conceptId' },
    },
  },
  creator_products: {
    table: creatorProducts,
    sides: {
      creator: { column: creatorProducts.creatorId, key: 'creatorId' },
      product: { column: creatorProducts.productId, key: 'productId' },
    },
  },
  angle_products: {
    table: angleProducts,
    sides: {
      angle: { column: angleProducts.angleId, key: 'angleId' },
      product: { column: angleProducts.productId, key: 'productId' },
    },
  },
  angle_personas: {
    table: anglePersonas,
    sides: {
      angle: { column: anglePersonas.angleId, key: 'angleId' },
      persona: { column: anglePersonas.personaId, key: 'personaId' },
    },
  },
};

function sidesOf(spec: LinkSpec): { table: PgTable; source: JunctionSide; target: JunctionSide } {
  const junction = JUNCTIONS[spec.junction];
  const source = junction.sides[spec.source];
  const target = junction.sides[spec.target];
  if (source === undefined || target === undefined) {
    throw new Error(`${spec.source} → ${spec.target} is not a side of ${spec.junction}`);
  }
  return { table: junction.table, source, target };
}

/** De-duplicated, blanks dropped, order kept — the list a write ends with. */
function normalise(ids: readonly string[]): readonly string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of ids) {
    const id = raw.trim();
    if (id === '' || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/** The ids linked to `sourceId` on the spec's side of its junction. */
export async function listLinkedIds(db: Db, spec: LinkSpec, sourceId: string): Promise<string[]> {
  const { table, source, target } = sidesOf(spec);
  const rows = await db
    .select({ id: target.column })
    .from(table)
    .where(eq(source.column, sourceId));
  return rows.map((row) => String(row.id));
}

/** The ids of a brand's own LIVE rows of one link side's table. */
function idsOf(rows: readonly { id: string }[]): ReadonlySet<string> {
  return new Set(rows.map((row) => row.id));
}

/**
 * Every id the brand really owns on one side of a link. The switch is exhaustive over `LinkTable`
 * with no `default`, so widening that union is a compile error here — a new link side cannot be
 * registered without saying which brand-scoped table proves its ids.
 */
async function liveIds(db: Db, brandId: string, table: LinkTable): Promise<ReadonlySet<string>> {
  const scope = withBrand(db, brandId);
  switch (table) {
    case 'concept':
      return idsOf(await scope.select(concepts));
    case 'angle':
      return idsOf(await scope.select(angles));
    case 'creator':
      return idsOf(await scope.select(creators));
    case 'product':
      return idsOf(await scope.select(products));
    case 'persona':
      return idsOf(await scope.select(personas));
  }
}

/**
 * Replaces the links of `sourceId` on the spec's side with `targetIds`: delete that side's rows, insert
 * the new pairs. Returns the ids as written (normalised). Idempotent: writing the same list twice
 * leaves one row per pair.
 *
 * It does NOT check the ids against a brand — junction tables carry no `brand_id` and this function
 * cannot see one. A caller that takes ids from a form uses `syncLinksInBrand`.
 */
export async function syncLinks(
  db: Db,
  spec: LinkSpec,
  sourceId: string,
  targetIds: readonly string[],
): Promise<readonly string[]> {
  const { table, source, target } = sidesOf(spec);
  const ids = normalise(targetIds);
  await db.delete(table).where(eq(source.column, sourceId));
  if (ids.length > 0) {
    await db
      .insert(table)
      .values(ids.map((id: string) => ({ [source.key]: sourceId, [target.key]: id })));
  }
  return ids;
}

/**
 * The write path a Server Action uses: every submitted id is checked against the brand's LIVE rows
 * of the TARGET table first, so a link can never point a concept at another brand's creator or a
 * product at another brand's angle. The action already proves the SOURCE row is the brand's own (the
 * scoped getter behind `ownsSource`), which left the submitted ids — a plain array in a request body
 * — as the unchecked half: the junction has no `brand_id` of its own to catch them.
 *
 * An id that does not resolve is DROPPED, never stored and never an error, exactly as
 * `syncYoutubeCopyLinks` treats one: the control only ever offers the brand's own rows, so a
 * stranger's id did not come from the form.
 */
export async function syncLinksInBrand(
  db: Db,
  brandId: string,
  spec: LinkSpec,
  sourceId: string,
  targetIds: readonly string[],
): Promise<readonly string[]> {
  const live = await liveIds(db, brandId, spec.target);
  return syncLinks(
    db,
    spec,
    sourceId,
    normalise(targetIds).filter((id) => live.has(id)),
  );
}
