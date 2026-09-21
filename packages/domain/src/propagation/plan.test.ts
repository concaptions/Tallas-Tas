import { describe, expect, it } from 'vitest';

import { buildPropagationPlan, decideAction } from './plan';

describe('decideAction', () => {
  it('returns insert when trigger is insert and no override', () => {
    expect(decideAction('insert', false)).toBe('insert');
  });

  it('returns update when trigger is update and no override', () => {
    expect(decideAction('update', false)).toBe('update');
  });

  it('returns soft_delete when trigger is soft_delete and no override', () => {
    expect(decideAction('soft_delete', false)).toBe('soft_delete');
  });

  it('returns skip when child has local override regardless of trigger', () => {
    expect(decideAction('insert', true)).toBe('skip');
    expect(decideAction('update', true)).toBe('skip');
    expect(decideAction('soft_delete', true)).toBe('skip');
  });
});

describe('buildPropagationPlan', () => {
  it('builds a plan with one step per child', () => {
    const plan = buildPropagationPlan('insert', 'personas', 'row-1', [
      { brandId: 'brand-a', hasLocalOverride: false },
      { brandId: 'brand-b', hasLocalOverride: true },
      { brandId: 'brand-c', hasLocalOverride: false },
    ]);

    expect(plan.trigger).toBe('insert');
    expect(plan.tableName).toBe('personas');
    expect(plan.templateRowId).toBe('row-1');
    expect(plan.steps).toHaveLength(3);
    expect(plan.steps[0]).toMatchObject({ childBrandId: 'brand-a', action: 'insert' });
    expect(plan.steps[1]).toMatchObject({ childBrandId: 'brand-b', action: 'skip' });
    expect(plan.steps[2]).toMatchObject({ childBrandId: 'brand-c', action: 'insert' });
  });

  it('produces all-skip plan when every child has overrides', () => {
    const plan = buildPropagationPlan('update', 'angles', 'row-2', [
      { brandId: 'brand-a', hasLocalOverride: true },
      { brandId: 'brand-b', hasLocalOverride: true },
    ]);

    expect(plan.steps.every((s) => s.action === 'skip')).toBe(true);
  });

  it('produces empty plan when there are no children', () => {
    const plan = buildPropagationPlan('insert', 'themes', 'row-3', []);
    expect(plan.steps).toHaveLength(0);
  });
});
