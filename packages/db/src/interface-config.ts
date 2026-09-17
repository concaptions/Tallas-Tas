import { asc, eq } from 'drizzle-orm';

import type { Db } from './db';
import { interfaceFields, interfacePages, type InterfaceField, type InterfacePage } from './schema';
import { withBrand } from './tenancy';

/**
 * The Interface Config page's data access (PRD §10: which pages the client sees, and which fields
 * those pages show). Every function takes the database as its first argument (no module-level
 * singleton) and reads and writes through `withBrand(db, brandId)`, so
 * `brand_id = $brandId AND deleted_at IS NULL` is on every statement and a configuration cannot be
 * read, re-ordered or switched off from another brand's session. Nothing here contains business
 * logic: the DEFAULTS are `defaultInterfaceConfig()` in `packages/domain`, and what a client may
 * edit is decided by the interface, not by these queries.
 */

/** A field of a configured page. Named `...Row` like every other row type a page renders. */
export type InterfaceFieldRow = InterfaceField;

/**
 * One configured page with its fields nested, in `position` order — the shape the config tree and
 * the client's own interface both read. `demoInterfaceConfig` satisfies `InterfacePageRow[]`, so
 * the page renders demo fixtures and database rows through one type and without a branch.
 *
 * Nested rather than two flat lists because every consumer needs the pairing: the tree indents the
 * fields under their page, and the preview asks a page for its visible fields. A page with no
 * configured fields — Partnership Ads Tracking on a brand that only ever groups and filters —
 * carries an empty array, never null.
 */
export type InterfacePageRow = InterfacePage & { fields: InterfaceFieldRow[] };

/**
 * The brand's live interface configuration: every enabled and disabled page in `position` order,
 * each with its own fields in `position` order.
 *
 * Two scoped reads nested in TypeScript rather than one SQL join, for the reason `listPersonas`
 * gives at length: `withBrand` hands back a sealed query surface with no join, `where` or
 * `$dynamic`, which is the guarantee a scoped read cannot be widened. Two scoped statements keep
 * that guarantee and produce the same left-join semantics — a page with no fields comes back with
 * `fields: []`, and a field whose page is soft-deleted or belongs to another brand is dropped
 * rather than surfacing as a parentless row. Five pages and a few dozen fields per brand, so the
 * second index scan costs nothing.
 *
 * Disabled pages and invisible fields are RETURNED, not filtered: this is the configuration screen's
 * read, and it must show a switched-off page in order to switch it back on. The client interface
 * filters on `enabled` / `visible` when it renders.
 */
export async function listInterfaceConfig(db: Db, brandId: string): Promise<InterfacePageRow[]> {
  const scope = withBrand(db, brandId);
  const [pages, fields] = await Promise.all([
    scope.select(interfacePages).orderBy(asc(interfacePages.position)),
    scope.select(interfaceFields).orderBy(asc(interfaceFields.position)),
  ]);
  const fieldsByPage = new Map<string, InterfaceFieldRow[]>(pages.map((page) => [page.id, []]));
  for (const field of fields) {
    fieldsByPage.get(field.pageId)?.push(field);
  }
  return pages.map((page) => ({ ...page, fields: fieldsByPage.get(page.id) ?? [] }));
}

/** One live page of the brand with its fields, or null: another brand's id never resolves. */
export async function getInterfacePageById(
  db: Db,
  brandId: string,
  id: string,
): Promise<InterfacePageRow | null> {
  const scope = withBrand(db, brandId);
  const [page] = await scope.select(interfacePages, eq(interfacePages.id, id)).limit(1);
  if (page === undefined) return null;
  const fields = await scope
    .select(interfaceFields, eq(interfaceFields.pageId, page.id))
    .orderBy(asc(interfaceFields.position));
  return { ...page, fields };
}

/**
 * Shows or hides one field on the client's interface and returns the row, or null when the id
 * belongs to another brand or to a soft-deleted row — the scope makes those the same outcome: zero
 * rows changed. `client_editable` is untouched, because whether the client MAY change a field is a
 * property of the field (PRD §10's table), not of whether this brand currently shows it.
 */
export async function setFieldVisibility(
  db: Db,
  brandId: string,
  id: string,
  visible: boolean,
  actorId: string,
): Promise<InterfaceFieldRow | null> {
  const [row] = await withBrand(db, brandId)
    .update(
      interfaceFields,
      { visible, updatedBy: actorId, updatedAt: new Date() },
      eq(interfaceFields.id, id),
    )
    .returning();
  return row ?? null;
}

/**
 * Switches one page of the client's interface on or off and returns it with its fields, or null
 * when the id belongs to another brand or to a soft-deleted row.
 *
 * The page's FIELDS are deliberately left alone. PRD §10 switches pages and fields independently,
 * so disabling Copywriting must not rewrite the `visible` flag of the fields underneath it: the
 * page comes back on with exactly the field set it had, which is the behaviour the config tree
 * promises when it mutes those rows instead of clearing them.
 */
export async function setPageEnabled(
  db: Db,
  brandId: string,
  id: string,
  enabled: boolean,
  actorId: string,
): Promise<InterfacePageRow | null> {
  const [row] = await withBrand(db, brandId)
    .update(
      interfacePages,
      { enabled, updatedBy: actorId, updatedAt: new Date() },
      eq(interfacePages.id, id),
    )
    .returning();
  if (row === undefined) return null;
  const fields = await withBrand(db, brandId)
    .select(interfaceFields, eq(interfaceFields.pageId, row.id))
    .orderBy(asc(interfaceFields.position));
  return { ...row, fields };
}
