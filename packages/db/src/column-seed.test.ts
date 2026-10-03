import { describe, expect, it } from 'vitest';

import { resolveColumns } from './column-definitions';
import { seedColumnDefinitions } from './column-seed';
import { seed } from './seed';
import { brands } from './schema';
import { eq } from 'drizzle-orm';
import { testDb } from './testing';

/**
 * THE GATE the owner set before Wave 2 fans out: with the seed applied, Gratsi's Personas page must
 * resolve to exactly seven columns under Gratsi's own labels, in Gratsi's order, and a brand that
 * inherits must resolve to the parent's fuller set under the PARENT's labels.
 */
describe('the column seed, resolved per brand', () => {
  it('gives Gratsi exactly the seven Gratsi labels, in order', async () => {
    const db = await testDb();
    await seed(db);
    await seedColumnDefinitions(db);
    const [gratsi] = await db
      .select({ id: brands.id })
      .from(brands)
      .where(eq(brands.slug, 'gratsi'));
    if (gratsi === undefined) throw new Error('the seed has no gratsi brand');

    const resolved = await resolveColumns(db, gratsi.id, 'personas');

    expect(resolved.map((column) => column.displayLabel)).toEqual([
      'Name',
      'Description [Age Status Salary]',
      'Personality',
      'Drivers for this persona',
      'Passion',
      'Problem-Solution Awareness Level',
      'Angles',
    ]);
    // The keys behind those labels are the Postgres columns, unrenamed.
    expect(resolved.map((column) => column.columnKey)).toEqual([
      'name',
      'demographic',
      'psychographic',
      'core_desires',
      'passion',
      'stage_of_awareness',
      'angle_personas',
    ]);
    // Nine parent columns are hidden, not dropped, and never appear.
    for (const hidden of [
      'day_in_the_life',
      'emotional_triggers',
      'pain_points',
      'success_factors',
      'perceived_barriers',
      'buying_triggers',
      'problem_challenge',
      'success_transformation',
      'trigger_words',
    ]) {
      expect(resolved.map((column) => column.columnKey)).not.toContain(hidden);
    }
    // `product_id` needs no row at all: the parent base has no Product field, so nothing emits it.
    expect(resolved.map((column) => column.columnKey)).not.toContain('product_id');
    // Passion is Gratsi's own column; the others are the parent's, overridden.
    expect(resolved.find((column) => column.columnKey === 'passion')?.source).toBe('custom');
    expect(resolved.every((column) => column.isDetached)).toBe(true);
  });

  it('gives an inheriting brand the parent set, under the PARENT labels, not Gratsi relabels', async () => {
    const db = await testDb();
    await seed(db);
    await seedColumnDefinitions(db);
    const [niagara] = await db
      .select({ id: brands.id })
      .from(brands)
      .where(eq(brands.slug, 'niagara-sleep-solutions'));
    // The seed's demo child may be named differently; fall back to any non-template child.
    const child =
      niagara ??
      (
        await db.select({ id: brands.id }).from(brands).where(eq(brands.isTemplate, false)).limit(1)
      )[0];
    if (child === undefined) throw new Error('the seed has no child brand');

    const resolved = await resolveColumns(db, child.id, 'personas');

    // The fuller set: all fifteen parent columns, none hidden.
    expect(resolved).toHaveLength(15);
    expect(resolved.map((column) => column.displayLabel).slice(0, 5)).toEqual([
      'Persona Name',
      'A Day in the Life',
      'Demographic',
      'Psychographic',
      'Core Desires (Cashvertising)',
    ]);
    // The parent's names, NOT Gratsi's — the two naming worlds stay apart.
    expect(resolved.map((column) => column.displayLabel)).not.toContain(
      'Description [Age Status Salary]',
    );
    expect(resolved.map((column) => column.displayLabel)).not.toContain('Drivers for this persona');
    // It carries the columns Gratsi hides, which is the point: hiding is per base.
    expect(resolved.map((column) => column.columnKey)).toContain('day_in_the_life');
    expect(resolved.map((column) => column.columnKey)).toContain('pain_points');
    // And it has no row of its own, so every column is marked as inherited.
    expect(resolved.every((column) => column.inheritedFrom !== null)).toBe(true);
    expect(resolved.every((column) => !column.isDetached)).toBe(true);
  });

  it('is idempotent: seeding twice changes nothing', async () => {
    const db = await testDb();
    await seed(db);
    await seedColumnDefinitions(db);
    const [gratsi] = await db
      .select({ id: brands.id })
      .from(brands)
      .where(eq(brands.slug, 'gratsi'));
    if (gratsi === undefined) throw new Error('the seed has no gratsi brand');
    const once = await resolveColumns(db, gratsi.id, 'personas');
    await seedColumnDefinitions(db);
    expect(await resolveColumns(db, gratsi.id, 'personas')).toEqual(once);
  });
});
