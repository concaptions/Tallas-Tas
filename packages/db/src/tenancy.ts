import { and, eq, isNull, sql, type SQL } from 'drizzle-orm';
import { CasingCache } from 'drizzle-orm/casing';
import type {
  AnyPgColumn,
  PgColumn,
  PgInsertValue,
  PgTable,
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

/**
 * An insert payload for the scope: the table's insert model without `brand_id`, which is not the
 * caller's to choose. Derived from `$inferInsert`, not from `Omit<PgInsertValue<T>, 'brandId'>`: for a
 * generic table that `Omit` keeps only the required keys, so `id`, `created_by` and `deleted_at` were
 * rejected with TS2353 although plain Drizzle accepts them (TICKET-005 round 3).
 */
export type ScopedInsertValue<T extends BrandedTable> = Omit<T['$inferInsert'], 'brandId'>;

/** An update payload for the scope: any subset of the insert model, `brand_id` excluded. */
export type ScopedUpdateSet<T extends BrandedTable> = Partial<Omit<T['$inferInsert'], 'brandId'>>;

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

/** The part of a Drizzle insert or update builder the scope delegates to. */
interface WriteBuilder extends PromiseLike<unknown> {
  returning(): PromiseLike<unknown>;
}

/**
 * A Drizzle `$dynamic()` select builder already has the `ScopedSelect` shape; the seal is a plain
 * object that keeps the builder, and everything else it has (`where`, `$dynamic`, joins), in a closure.
 */
function sealSelect<Row>(query: ScopedSelect<Row>): ScopedSelect<Row> {
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
 * The caller's filter, parenthesised so that a top-level OR binds inside the scope, after a check
 * that the parenthesis cannot be closed from within. The filter is rendered with identifiers,
 * parameters and inlined literals blanked (`SQL.toQuery` with empty escapes), which leaves the literal
 * SQL text a raw `sql` fragment contributes; Drizzle's own builders add only balanced parentheses at
 * render time. That text must keep its parentheses nested, never closing more than it opened, and carry
 * no quote, dollar quote, statement end or comment start, the lexemes that would hide a parenthesis
 * from Postgres. `eq`, `and`, `or`, `not`, `inArray`, `exists`, `between`, ... and a raw fragment with
 * bound parameters pass; `true) or (true` and `true) or true) --` throw before any query runs
 * (TICKET-005 round 5).
 */
function contained(where: SQL): SQL {
  const blank = (): string => '';
  const blanks = { escapeName: blank, escapeParam: blank, escapeString: blank };
  const { sql: text } = where.toQuery({ casing: new CasingCache(), ...blanks });
  let depth = 0;
  for (const char of text) {
    depth += char === '(' ? 1 : char === ')' ? -1 : 0;
    if (depth < 0) break;
  }
  if (depth !== 0 || /['"$;]|--|\/\*/.test(text)) {
    throw new Error(`withBrand: filter is not contained by the brand scope: ${text}`);
  }
  return sql`(${where})`;
}

/** `brand_id = $brandId AND deleted_at IS NULL`, then the caller's own filter, if any, contained. */
function scopeOf(table: BrandedTable, brandId: string, where: SQL | undefined): SQL | undefined {
  return and(eq(table.brandId, brandId), isNull(table.deletedAt), where && contained(where));
}

/**
 * The single door to a brand's rows (CLAUDE.md: tenancy at the query layer). Every query it builds
 * carries `brand_id = $brandId AND deleted_at IS NULL`, with the caller's `where` ANDed after it,
 * parenthesised and checked by `contained` (a raw fragment that could close that parenthesis throws).
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
