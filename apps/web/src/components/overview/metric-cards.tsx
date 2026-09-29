import Link from 'next/link';

import type { MetricCard } from '@/lib/dashboard-source';

/**
 * The Overview's pipeline cards (TASK 6): one card per stage the role scans for, each linking to
 * the table view already filtered to what it counted. Pure presentation — every count and href is
 * computed in `dashboard-source`, so this renders whatever it is handed, demo or live.
 */
export function MetricCards({ cards }: { readonly cards: readonly MetricCard[] }) {
  if (cards.length === 0) return null;
  return (
    <section className="flex flex-col gap-3" data-slot="overview-metrics">
      <h2 className="text-sm font-medium text-text2">Pipeline at a glance</h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {cards.map((card) => (
          <Link
            key={card.key}
            href={card.href}
            data-slot="overview-metric"
            data-metric={card.key}
            className="flex flex-col gap-1.5 rounded-card border border-line bg-surface2 px-4 py-3 transition-colors hover:border-accent-line hover:bg-surface3"
          >
            <span className="flex items-center gap-2 text-xs text-text3">
              <span aria-hidden>{card.emoji}</span>
              {card.label}
            </span>
            <span className="font-mono text-2xl text-text" data-slot="overview-metric-count">
              {card.count}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
