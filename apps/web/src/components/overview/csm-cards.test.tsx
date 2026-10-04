import { describe, expect, it } from 'vitest';

import {
  brandPanelsHeader,
  buildOverviewMetrics,
  overviewMetrics,
  type BrandPanel,
} from '@/lib/dashboard-source';

import { CsmCards } from './csm-cards';

/** Every element in the returned tree. No DOM: this app has no renderer (see top-bar.test.tsx). */
function* elements(node: unknown): Generator<{ type: unknown; props: Record<string, unknown> }> {
  if (Array.isArray(node)) {
    for (const child of node) {
      yield* elements(child);
    }
    return;
  }
  if (typeof node === 'object' && node !== null && 'props' in node) {
    const element = node as { type: unknown; props: Record<string, unknown> };
    yield element;
    yield* elements(element.props.children);
  }
}

function bySlot(tree: unknown, slot: string) {
  return [...elements(tree)].filter((element) => element.props['data-slot'] === slot);
}

/** Two panels over REAL derived numbers: the fixtures' counts and an empty book's zeroes. */
const PANELS: BrandPanel[] = [
  {
    brandId: 'panel-niagara',
    brandName: 'Niagara Sleep Solutions',
    metrics: overviewMetrics('csm'),
  },
  {
    brandId: 'panel-gratsi',
    brandName: 'Gratsi',
    metrics: buildOverviewMetrics('csm', { briefs: [], concepts: [], creators: [] }),
  },
];

describe('CsmCards', () => {
  it('renders nothing below two brands — the single-brand Overview already covers that actor', () => {
    expect(CsmCards({ role: 'csm', panels: [] })).toBeNull();
    expect(CsmCards({ role: 'csm', panels: PANELS.slice(0, 1) })).toBeNull();
  });

  it('draws one card per brand under the derived header line, never a hardcoded number', () => {
    const tree = CsmCards({ role: 'csm', panels: PANELS });

    expect(bySlot(tree, 'csm-cards')).toHaveLength(1);
    expect(bySlot(tree, 'csm-card')).toHaveLength(2);

    // The heading is exactly the pure derivation over these panels — the component adds nothing.
    const heading = [...elements(tree)].find((element) => element.props.id === 'csm-cards-heading');
    expect(heading?.props.children).toBe(brandPanelsHeader('csm', PANELS));

    // A CSM's card carries the whole eleven-metric pipeline, keyed, per brand.
    const rows = bySlot(tree, 'csm-card-metric');
    expect(rows).toHaveLength(22);
    expect(new Set(rows.map((row) => row.props['data-metric'])).size).toBe(11);
  });

  it('dims a zero count the way the reference dims "0 Designs in Progress"', () => {
    const tree = CsmCards({ role: 'csm', panels: PANELS });

    const rows = bySlot(tree, 'csm-card-metric');
    const zeroes = rows.filter((row) => row.props['data-zero'] === true);
    // The empty brand's eleven rows are all zero; the fixture brand has at least one non-zero.
    expect(zeroes.length).toBeGreaterThanOrEqual(11);
    expect(zeroes.length).toBeLessThan(rows.length);
  });
});
