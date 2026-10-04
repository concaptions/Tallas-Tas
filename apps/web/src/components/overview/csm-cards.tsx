import { Card, CardContent, CardHeader, CardTitle } from '@tas/ui';
import type { BrandRole } from '@tas/domain';

import { brandPanelsHeader, totalAssetCount, totalAssetsLabel } from '@/lib/dashboard-source';
import type { BrandPanel } from '@/lib/dashboard-source';

/**
 * The cross-client card shell (AI-06), after the reference dashboard's CLIENT SUCCESS MANAGERS
 * section (docs/prd-assets/dashboard-reference.png). The reference draws one card per CSM — name,
 * then "ADVERTISING CSM · 15 CLIENTS · 284 TOTAL ASSETS", then the metric counts of their whole
 * book. Here the viewer IS the CSM, so the shell is their card turned inside out: the header line
 * carries the role, the client count and the asset total of the signed-in actor's book, and the
 * body breaks that book down into one card per assigned brand, each counting only its own rows.
 *
 * Every number is handed in by AI-09's loader and the pure helpers in `dashboard-source` — nothing
 * is computed here, and nothing is hardcoded. The counts are NOT links on purpose: a metric card's
 * href filters the ACTIVE brand's table, so a link on another brand's count would land on the
 * wrong brand's rows; switching brands stays the switcher's job. Zero counts render dimmed, the
 * reference's own treatment ("0 Designs in Progress" greys out).
 *
 * Renders nothing below two brands: a single-brand actor keeps the single-brand Overview, which
 * already shows these metrics for the one brand in scope.
 */
export interface CsmCardsProps {
  readonly role: BrandRole | 'admin';
  readonly panels: readonly BrandPanel[];
}

export function CsmCards({ role, panels }: CsmCardsProps) {
  if (panels.length < 2) {
    return null;
  }
  return (
    <section
      aria-labelledby="csm-cards-heading"
      data-slot="csm-cards"
      className="flex flex-col gap-3"
    >
      <h2
        id="csm-cards-heading"
        className="font-mono text-[11px] tracking-wide text-text3 uppercase"
      >
        {brandPanelsHeader(role, panels)}
      </h2>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {panels.map((panel) => (
          <Card key={panel.brandId} data-slot="csm-card" className="gap-3 py-4">
            <CardHeader className="px-4">
              <CardTitle className="text-base font-semibold tracking-tight text-text">
                {panel.brandName}
              </CardTitle>
              <p
                data-slot="csm-card-assets"
                className="font-mono text-[11px] tracking-wide text-text3 uppercase"
              >
                {totalAssetsLabel(totalAssetCount(panel.metrics))}
              </p>
            </CardHeader>
            <CardContent className="px-4">
              <ul className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
                {panel.metrics.map((card) => (
                  <li
                    key={card.key}
                    data-slot="csm-card-metric"
                    data-metric={card.key}
                    data-zero={card.count === 0}
                    className="flex items-baseline gap-2"
                  >
                    <span aria-hidden className="text-xs">
                      {card.emoji}
                    </span>
                    <span
                      data-slot="csm-card-metric-count"
                      className={`font-mono text-sm ${card.count === 0 ? 'text-text4' : 'text-text'}`}
                    >
                      {card.count}
                    </span>
                    <span className={`text-xs ${card.count === 0 ? 'text-text4' : 'text-text2'}`}>
                      {card.label}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
