import { and, eq, isNull, sql, type SQL } from 'drizzle-orm';
import type {
  AnyPgColumn,
  PgColumn,
  PgInsertValue,
  PgQueryResultHKT,
  PgTable,
  PgUpdateBuilder,
  TableLikeHasEmptySelection,
} from 'drizzle-orm/pg-core';

import type { Db } from './db';

/**
 * A table `withBrand` may touch: a `PgTable` whose `brand_id` column is NOT NULL, carrying the shared
 * `deleted_at`. Every table has `brand_id` through `baseColumns()`, nullable, so nullability is the
 * discriminator: `agencies`, `brands`, `users` and `memberships` fail this constraint at compile time;
 * a table that overrides `brandId` with `.notNull()` (first `brand_assignments`) satisfies it.
 */
export type BrandedTable = PgTable & {
  brandId: AnyPgColumn<{ notNull: true; data: string }>;
  deletedAt: AnyPgColumn;
};

/** An insert payload for the scope: `brand_id` is not the caller's to choose. */
export type ScopedInsertValue<T extends BrandedTable> = Omit<PgInsertValue<T>, 'brandId'>;

/**
 * An update payload for the scope: `brand_id` is not the caller's to change. Named through the
 * builder's `set` signature rather than Drizzle's `PgUpdateSetSource<T>` alias: that alias is an
 * all-optional mapped type over a generic table, which typed lint reads as the empty object type.
 */
export type ScopedUpdateSet<T extends BrandedTable> = Omit<
  Parameters<PgUpdateBuilder<T, PgQueryResultHKT>['set']>[0],
  'brandId'
>;

/**
 * A scoped read: `await` runs it, `orderBy` and `limit` shape it. Nothing on it can change which
 * rows it reaches; Drizzle's builder, whose `where` is fixed, stays inside `withBrand`.
 */
export interface ScopedSelect<Row> extends PromiseLike<Row[]> {
  orderBy(...columns: (PgColumn | SQL)[]): ScopedSelect<Row>;
  limit(count: number): ScopedSelect<Row>;
}

/** A scoped write: `await` runs it and resolves to nothing, `returning()` runs it and yields its rows. */
export interface ScopedWrite<Row> extends PromiseLike<void> {
  returning(): Promise<Row[]>;
}

/** What `withBrand` returns: the only query surface a branded table is read or written through. */
export type BrandScope = ReturnType<typeof withBrand>;

/** The part of a Drizzle `$dynamic()` select builder the scope delegates to. */
interface SelectBuilder<Row> extends PromiseLike<Row[]> {
  orderBy(...columns: (PgColumn | SQL)[]): SelectBuilder<Row>;
  limit(count: number): SelectBuilder<Row>;
}

/** The part of a Drizzle insert or update builder the scope delegates to. */
interface WriteBuilder extends PromiseLike<unknown> {
  returning(): PromiseLike<unknown>;
}

function sealSelect<Row>(query: SelectBuilder<Row>): ScopedSelect<Row> {
  return {
    orderBy: (...columns) => sealSelect(query.orderBy(...columns)),
    limit: (count) => sealSelect(query.limit(count)),
    then: (onFulfilled, onRejected) => query.then(onFulfilled, onRejected),
  };
}

/**
 * The rows are typed from `T`, the table the caller names, not from the builder: Drizzle types a plain
 * update's `returning()` through its join-aware result type, a conditional it resolves only for a
 * concrete table, so the rows arrive as `unknown` here and are asserted once. A whole-row `returning()`
 * on a scoped write of a single table yields exactly that table's rows.
 */
function sealWrite<T extends BrandedTable>(query: WriteBuilder): ScopedWrite<T['$inferSelect']> {
  return {
    returning: () => Promise.resolve(query.returning()) as Promise<T['$inferSelect'][]>,
    then: (onFulfilled, onRejected) => query.then(() => undefined).then(onFulfilled, onRejected),
  };
}

/**
 * `brand_id = $brandId AND deleted_at IS NULL`, then the caller's own filter, if any. The filter is
 * parenthesised: a raw `sql` fragment with a top-level OR would otherwise bind looser than the scope.
 */
function scopeOf(table: BrandedTable, brandId: string, where: SQL | undefined): SQL | undefined {
  return and(eq(table.brandId, brandId), isNull(table.deletedAt), where && sql`(${where})`);
}

/**
 * The single door to a brand's rows (CLAUDE.md: tenancy at the query layer). Every query it builds
 * carries `brand_id = $brandId AND deleted_at IS NULL`, with the caller's `where` ANDed after it.
 * Inserts and updates store the scoped brand whatever the payload says, so a row can neither be written
 * into nor moved to another brand, and a soft delete only ever reaches the scoped brand's live rows.
 * The methods return `ScopedSelect` / `ScopedWrite`, not Drizzle's builders: `where`, `$dynamic`,
 * `onConflict*`, joins and set operations are out of reach, so the scope cannot be replaced or widened.
 * `db` may be a `db.transaction(...)` handle.
 */
export function withBrand(db: Db, brandId: string) {
  return {
    brandId,

    select<T extends BrandedTable>(table: T, where?: SQL) {
      // Drizzle types the `from` argument as `TableLikeHasEmptySelection<T> extends true ? error : T`,
      // a conditional it resolves only for a concrete table. A table is never a subquery, so the
      // false branch always applies; the assertion says so for the generic case.
      const source = table as TableLikeHasEmptySelection<T> extends true ? never : T;
      const scoped = scopeOf(table, brandId, where);
      // `$dynamic()` makes `orderBy` and `limit` return the builder itself, which the seal needs; it is
      // called on a builder whose `where` is already set and never leaves this function.
      return sealSelect(db.select().from(source).where(scoped).$dynamic());
    },

    insert<T extends BrandedTable>(
      table: T,
      values: ScopedInsertValue<T> | ScopedInsertValue<T>[],
    ) {
      const rows = Array.isArray(values) ? values : [values];
      // Re-attaching `brandId` restores the exact key `ScopedInsertValue` removed; TypeScript cannot
      // see that through the generic, so the merged row is asserted back to Drizzle's payload type.
      return sealWrite<T>(
        db.insert(table).values(rows.map((row) => ({ ...row, brandId }) as PgInsertValue<T>)),
      );
    },

    update<T extends BrandedTable>(table: T, set: ScopedUpdateSet<T>, where?: SQL) {
      const builder = db.update(table);
      // Same assertion as `insert`: the payload is the caller's set plus the scoped `brandId`.
      const values = { ...set, brandId } as Parameters<typeof builder.set>[0];
      return sealWrite<T>(builder.set(values).where(scopeOf(table, brandId, where)));
    },

    softDelete<T extends BrandedTable>(table: T, where?: SQL) {
      const builder = db.update(table);
      // Every branded table has `deletedAt` (the constraint says so); the generic payload type cannot
      // name it, hence the assertion. `now()` is the database clock, matching `defaultNow()`.
      const values = { deletedAt: sql`now()` } as Parameters<typeof builder.set>[0];
      return sealWrite<T>(builder.set(values).where(scopeOf(table, brandId, where)));
    },
  };
}
