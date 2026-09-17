import type { CreativeDimensionEntry } from '@tas/domain/creatives';

interface DimensionsGridProps {
  /** Already resolved by `briefDimensions`, in vocabulary order, never a raw stored array. */
  readonly entries: readonly CreativeDimensionEntry[];
}

/**
 * The delivery ratios a brief ships in (PRD §8, ticket criterion 7).
 *
 * A grid rather than a list because the ratios are read together — a designer checks that the set
 * is right, not what the third one is. The second line is the delivery size the PRD names for the
 * ratio, so nobody has to remember that 9:16 means 1080x1920. Both strings come from
 * `CREATIVE_DIMENSIONS` in `@tas/domain/creatives`; this component writes neither.
 *
 * Presentational, no directive, so the detail page (a client component) and `/design-system` (a
 * server page) can both mount it.
 */
export function DimensionsGrid({ entries }: DimensionsGridProps) {
  return (
    <ul data-slot="brief-dimensions" className="grid grid-cols-3 gap-2">
      {entries.map((entry) => (
        <li
          key={entry.key}
          data-slot="brief-dimension"
          data-dimension={entry.key}
          className="flex flex-col gap-0.5 rounded-input border border-line bg-surface2 px-2 py-1.5"
        >
          <span className="font-mono text-xs text-text2">{entry.label}</span>
          <span className="font-mono text-[10px] text-text4">{entry.pixels}</span>
        </li>
      ))}
    </ul>
  );
}
