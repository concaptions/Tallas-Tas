import { CsmCards } from '@/components/overview/csm-cards';
import { buildOverviewMetrics, overviewMetrics, type BrandPanel } from '@/lib/dashboard-source';

/**
 * The cross-client card shell (AI-06, UI governance rule 4): one card per assigned brand for a
 * multi-brand role, after the reference dashboard's CLIENT SUCCESS MANAGERS section. Both panels
 * are DERIVED — the demo fixtures' counts and an empty book's zeroes (which shows the dimmed-zero
 * treatment) — never typed-in numbers, exactly the rule the production card follows.
 */
const PANELS: BrandPanel[] = [
  {
    brandId: 'story-brand-niagara',
    brandName: 'Niagara Sleep Solutions',
    metrics: overviewMetrics('csm'),
  },
  {
    brandId: 'story-brand-gratsi',
    brandName: 'Gratsi',
    metrics: buildOverviewMetrics('csm', { briefs: [], concepts: [], creators: [] }),
  },
];

export function CsmCardsStory() {
  return <CsmCards role="csm" panels={PANELS} />;
}
