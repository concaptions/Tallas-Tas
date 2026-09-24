import { describe, expect, it } from 'vitest';

import { listPropagationRuns, logPropagationRun } from './propagation-runs';
import { propagateInterfaceConfig, propagateTemplateRow } from './propagation';
import { seed } from './seed';
import { testDb } from './testing';

const ACTOR = 'user_admin';
const A_ROW = '11111111-1111-4111-8111-000000000001';

async function seeded() {
  const db = await testDb();
  const { templateBrand, childBrand } = await seed(db);
  return { db, templateBrandId: templateBrand.id, otherBrandId: childBrand.id };
}

describe('the propagation ledger', () => {
  it('records a run and lists it back, newest first, scoped to the template brand', async () => {
    const { db, templateBrandId, otherBrandId } = await seeded();

    const first = await logPropagationRun(
      db,
      {
        templateBrandId,
        tableName: 'products',
        trigger: 'update',
        templateRowId: A_ROW,
        childrenUpdated: 3,
        skipped: 1,
      },
      ACTOR,
    );
    const second = await logPropagationRun(
      db,
      { templateBrandId, tableName: 'concepts', trigger: 'insert', childrenUpdated: 4, skipped: 0 },
      ACTOR,
    );
    // A run under a different template brand must never appear in this one's history.
    await logPropagationRun(
      db,
      {
        templateBrandId: otherBrandId,
        tableName: 'angles',
        trigger: 'sweep',
        childrenUpdated: 1,
        skipped: 0,
      },
      ACTOR,
    );

    const runs = await listPropagationRuns(db, templateBrandId);
    expect(runs.map((r) => r.id)).toEqual([second.id, first.id]);
    expect(runs[0]?.tableName).toBe('concepts');
    expect(runs[0]?.trigger).toBe('insert');
    expect(runs[1]?.childrenUpdated).toBe(3);
    expect(runs[1]?.skipped).toBe(1);
    expect(runs[1]?.templateRowId).toBe(A_ROW);
    expect(runs.every((r) => r.createdBy === ACTOR)).toBe(true);
  });

  it('honours the limit', async () => {
    const { db, templateBrandId } = await seeded();
    for (let i = 0; i < 3; i += 1) {
      await logPropagationRun(
        db,
        {
          templateBrandId,
          tableName: 'products',
          trigger: 'update',
          childrenUpdated: i,
          skipped: 0,
        },
        ACTOR,
      );
    }
    expect(await listPropagationRuns(db, templateBrandId, 2)).toHaveLength(2);
  });
});

describe('the engine writes a ledger row for every propagation it runs', () => {
  it('logs an interface-config push', async () => {
    const { db, templateBrandId } = await seeded();

    await propagateInterfaceConfig(db, templateBrandId, ACTOR);

    const runs = await listPropagationRuns(db, templateBrandId);
    const interfaceRun = runs.find((r) => r.trigger === 'interface');
    expect(interfaceRun).toBeDefined();
    expect(interfaceRun?.tableName).toBe('interface_config');
  });

  it('logs a per-row propagation even when the template row no longer resolves', async () => {
    const { db, templateBrandId } = await seeded();

    const result = await propagateTemplateRow(
      db,
      templateBrandId,
      'products',
      A_ROW,
      'update',
      ACTOR,
    );

    const runs = await listPropagationRuns(db, templateBrandId);
    const rowRun = runs.find((r) => r.tableName === 'products' && r.trigger === 'update');
    expect(rowRun).toBeDefined();
    expect(rowRun?.templateRowId).toBe(A_ROW);
    expect(rowRun?.childrenUpdated).toBe(result.childrenUpdated);
    expect(rowRun?.skipped).toBe(result.skipped);
  });
});
