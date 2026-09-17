import { desc, eq } from 'drizzle-orm';

import type { Db } from './db';
import { copywriting, creativeBriefs, type Copy, type NewCopy } from './schema';
import { withBrand, type BrandScope } from './tenancy';

/**
 * The Copywriting page's data access (PRD §5.11: ad copy, written separately but tied to the
 * creative). Every function takes the database as its first argument (no module-level singleton) and
 * every read and write goes through `withBrand(db, brandId)`, so
 * `brand_id = $brandId AND deleted_at IS NULL` is on every statement and an insert cannot choose its
 * own brand. Nothing here contains business logic; the domain functions call these.
 *
 * Two things this module never does. It never builds the Copy # TITLE — `copy_number` is the stored
 * integer and the title is the pure `copyTitle` in `packages/domain/src/copy` (CLAUDE.md
 * non-negotiable 6). And it never names a status: `status` is an opaque key here, and the set of
 * keys, their labels and their tones live in `@tas/domain/state` (non-negotiable 2).
 */

/** The columns the scope, the clock and the actor own; a caller never sets them. */
type ManagedColumn =
  'id' | 'brandId' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy' | 'deletedAt';

/**
 * What the copy panel submits for create and, partially, for update. `creativeBriefId` is in here and
 * may be `null`: attaching and DETACHING a row from its creative are both ordinary edits, which is
 * why the key is present rather than optional-only.
 */
export type CopyInput = Omit<NewCopy, ManagedColumn>;

/**
 * A copy row as the list and the panel render it: the row plus the name of the creative it is tied
 * to, or `null`.
 *
 * `creativeName` is `string | null`, and null is the ordinary case, not an error: copy is drafted
 * before it is attached (`creativeBriefId` null), and the Copywriting table renders that as a muted
 * em dash rather than a blank. It is also null when the link points at another brand's brief or at a
 * soft-deleted one, which the scoped read below makes the same outcome — a link that no longer
 * resolves reads exactly like a link that was never made, and neither leaks a name across brands.
 *
 * `demoCopy` satisfies `CopyListRow[]`, so the page reads demo fixtures and database rows through one
 * type.
 */
export type CopyListRow = Copy & { creativeName: string | null };

/**
 * The brand's live creative names, indexed by brief id, from one scoped read.
 *
 * Joined in TypeScript rather than with a SQL `leftJoin`, for the reason `listPersonas` gives:
 * `withBrand` hands back a sealed query surface with no join, `where` or `$dynamic`, and that seal is
 * the guarantee a scoped read cannot be widened. The read is scoped, so another brand's briefs — and
 * soft-deleted ones — are gone before a single name is attached; the semantics are a LEFT JOIN's
 * exactly (a missing brief yields null, and the copy row is still returned) at the cost of one extra
 * index scan over a table with at most a few dozen rows per brand.
 */
async function creativeNames(scope: BrandScope): Promise<Map<string, string>> {
  const briefs = await scope.select(creativeBriefs);
  return new Map(briefs.map((brief) => [brief.id, brief.name]));
}

/** One row with the creative's name attached, null wherever the link is absent or no longer live. */
function withCreativeName(row: Copy, names: Map<string, string>): CopyListRow {
  return {
    ...row,
    creativeName: row.creativeBriefId === null ? null : (names.get(row.creativeBriefId) ?? null),
  };
}

/**
 * The brand's live copy rows, newest edit first, each with the name of the creative it is tied to.
 * An UNATTACHED row is returned like any other, with `creativeName: null`: that is the whole point of
 * the nullable link (PRD §5.11).
 */
export async function listCopy(db: Db, brandId: string): Promise<CopyListRow[]> {
  const scope = withBrand(db, brandId);
  const [rows, names] = await Promise.all([
    scope.select(copywriting).orderBy(desc(copywriting.updatedAt)),
    creativeNames(scope),
  ]);
  return rows.map((row) => withCreativeName(row, names));
}

/** One live copy row of the brand, with its creative's name, or null: another brand's id never resolves. */
export async function getCopyById(
  db: Db,
  brandId: string,
  id: string,
): Promise<CopyListRow | null> {
  const scope = withBrand(db, brandId);
  const [row] = await scope.select(copywriting, eq(copywriting.id, id)).limit(1);
  if (row === undefined) return null;
  return withCreativeName(row, await creativeNames(scope));
}

/**
 * Creates a copy row in the scope; `brand_id` is the scope's, whatever `values` says.
 * `values.creativeBriefId` may be omitted entirely: that is a copy drafted before it is attached, a
 * supported create rather than a degraded one. `values.copyNumber` is the auto-generated Copy #, which
 * the caller computed; this function stores it and never builds one.
 */
export async function insertCopy(
  db: Db,
  brandId: string,
  values: CopyInput,
  actorId: string,
): Promise<Copy> {
  const [row] = await withBrand(db, brandId)
    .insert(copywriting, { ...values, createdBy: actorId, updatedBy: actorId })
    .returning();
  if (row === undefined) {
    throw new Error('copywriting insert returned no row');
  }
  return row;
}

/**
 * Patches one live copy row of the brand and returns it, or null when the id belongs to another brand
 * or to a soft-deleted row — the scope makes those the same outcome: zero rows changed.
 */
export async function updateCopy(
  db: Db,
  brandId: string,
  id: string,
  patch: Partial<CopyInput>,
  actorId: string,
): Promise<Copy | null> {
  const [row] = await withBrand(db, brandId)
    .update(
      copywriting,
      { ...patch, updatedBy: actorId, updatedAt: new Date() },
      eq(copywriting.id, id),
    )
    .returning();
  return row ?? null;
}
