import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { testDb } from './testing';

/**
 * Migration 0062 on PGlite (Scope A, ticket B1): the four client-page columns on
 * `custom_interface_pages`, their constraints, and the slug → `template_row_id` backfill. The
 * schema module does not read these columns yet — that lands with B2, after the migration is on
 * Railway — so this test speaks SQL to the migrated database, the way `migration 0006` tests do.
 */
describe('migration 0062 on PGlite', () => {
  it('adds page_kind (checked), module_key, template_row_id (FK, set null) and overridden_fields', async () => {
    const db = await testDb();

    const { rows } = await db.execute<{
      column_name: string;
      data_type: string;
      is_nullable: string;
      column_default: string | null;
    }>(sql`select column_name, data_type, is_nullable, column_default
           from information_schema.columns
           where table_name = 'custom_interface_pages'
             and column_name in ('page_kind', 'module_key', 'template_row_id', 'overridden_fields')
           order by column_name`);
    expect(rows).toEqual([
      { column_name: 'module_key', data_type: 'text', is_nullable: 'YES', column_default: null },
      {
        column_name: 'overridden_fields',
        data_type: 'jsonb',
        is_nullable: 'NO',
        column_default: "'[]'::jsonb",
      },
      {
        column_name: 'page_kind',
        data_type: 'text',
        is_nullable: 'NO',
        column_default: "'custom'::text",
      },
      {
        column_name: 'template_row_id',
        data_type: 'uuid',
        is_nullable: 'YES',
        column_default: null,
      },
    ]);

    // Drizzle wraps the Postgres error ("Failed query: …") and keeps the constraint in `cause`.
    const refused = await db
      .execute(
        sql`insert into custom_interface_pages (slug, title, source_table_key, page_kind)
                   values ('x', 'X', 'creative_briefs', 'widget')`,
      )
      .then(() => null)
      .catch((error: unknown) => error);
    expect(refused).toBeInstanceOf(Error);
    expect(String((refused as { cause?: unknown }).cause)).toMatch(
      /custom_interface_pages_page_kind_check/,
    );
  });

  it('backfills template_row_id for a child row inheriting by slug, and the FK nulls it on delete', async () => {
    const db = await testDb();
    // A template page and a child page with the same slug, written as the Oct 6/7 engine wrote them.
    await db.execute(
      sql`insert into agencies (id, name, slug) values ('a0000000-0000-4000-8000-000000000001', 'A', 'a')`,
    );
    await db.execute(sql`insert into brands (id, agency_id, name, slug, is_template)
                         values ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'T', 't', true),
                                ('b0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'C', 'c', false)`);
    await db.execute(sql`insert into custom_interface_pages (id, brand_id, slug, title, source_table_key, column_config)
                         values ('c0000000-0000-4000-8000-000000000001', null, 'p', 'P', 'creative_briefs', '[{"columnKey":"name","displayLabel":"Name","displayOrder":0}]'),
                                ('c0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000002', 'p', 'P', 'creative_briefs', '[{"columnKey":"name","displayLabel":"Name","displayOrder":0}]')`);
    // The backfill statement, exactly as 0062 runs it (the migration ran on an empty table here).
    await db.execute(sql`update custom_interface_pages c set template_row_id = t.id
                         from custom_interface_pages t
                         where c.brand_id is not null and c.template_row_id is null
                           and t.brand_id is null and t.deleted_at is null and t.slug = c.slug`);
    const linked = await db.execute<{ template_row_id: string | null }>(
      sql`select template_row_id from custom_interface_pages where id = 'c0000000-0000-4000-8000-000000000002'`,
    );
    expect(linked.rows[0]?.template_row_id).toBe('c0000000-0000-4000-8000-000000000001');

    await db.execute(
      sql`delete from custom_interface_pages where id = 'c0000000-0000-4000-8000-000000000001'`,
    );
    const after = await db.execute<{ template_row_id: string | null }>(
      sql`select template_row_id from custom_interface_pages where id = 'c0000000-0000-4000-8000-000000000002'`,
    );
    expect(after.rows[0]?.template_row_id).toBeNull();
  });
});
