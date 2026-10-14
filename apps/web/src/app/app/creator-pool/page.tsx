import { currentBrand } from '@/lib/data-source';
import { isDemoMode } from '@/lib/demo-mode';
import {
  loadRegistryBrandHistoryMap,
  loadRegistryCreators,
} from '@/lib/registry-source';

import { CreatorPool } from '@/app/app/ugc/creator-pool';

/**
 * The dedicated Creator Pool workspace (PRD §5.8, Oct 8 Talal sync, Ticket 13).
 *
 * A top-level nav section, not a UGC tab: the pool is GLOBAL (every creator TAS has worked with,
 * across every brand), the per-brand roster is brand-scoped. The legacy `/app/ugc?tab=pool` tab
 * stays live — this page is a sibling that lives in the sidebar.
 *
 * SERVER-SIDE DATA (Ticket 13 Phase B1). The registry rows AND every creator's brand history are
 * loaded here, in one connection, so the client component never fetches them. "Each creator's brand
 * history" is which brands have them in their roster today (per-brand `creators` rows joined to
 * the brand name), their per-brand `clientStatus` and when they were added — the ticket's
 * two-way-link read: the pool shows the brand history, the per-brand creator panel shows "In other
 * brands". Both sides read the same `creator_registry` row.
 *
 * The underlying `CreatorPool` client component is reused — it already renders the pool grid, the
 * brand-history aside and the "Add to {brand}" button through `addRegistryCreatorToBrandAction`.
 * `withBrandScope` targets whichever brand the viewer has selected in the switcher, so an add from
 * here lands on that brand's roster.
 */
export default async function CreatorPoolPage() {
  const [brand, creators] = await Promise.all([currentBrand(), loadRegistryCreators()]);
  const historyByCreatorId = await loadRegistryBrandHistoryMap(creators.map((c) => c.id));
  const demo = isDemoMode();
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <header className="flex flex-col gap-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-text3">Production</p>
        <h1 className="text-xl font-semibold text-text">Creator Pool</h1>
        <p className="max-w-prose text-sm text-text2">
          Every creator TAS has worked with, across every brand. Add one to{' '}
          <span className="font-medium text-text">{brand?.name ?? 'the active brand'}</span> from
          here and it joins that brand&apos;s roster.
        </p>
      </header>
      <CreatorPool
        brandName={brand?.name ?? 'this brand'}
        demo={demo}
        initialCreators={creators}
        initialHistoryByCreatorId={historyByCreatorId}
      />
    </div>
  );
}
