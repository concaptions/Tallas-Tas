import { eq } from 'drizzle-orm';
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core';

import type { Db } from './db';
import { anglePersonas, angleProducts, conceptAngles, creatorConcepts } from './schema';

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
  'concept_angles' | 'creator_concepts' | 'angle_products' | 'angle_personas';

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

/**
 * Replaces the links of `sourceId` on the spec's side with `targetIds`: delete that side's rows, insert
 * the new pairs. Returns the ids as written (normalised). Idempotent: writing the same list twice
 * leaves one row per pair.
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
