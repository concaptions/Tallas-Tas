import { parseInspoLink } from '@tas/domain/angles';

import { inspoSourceLabel } from './fields';

/**
 * One ad-inspiration link, as a rich preview card (PRD §5.6, "Ad Inspo").
 *
 * The preview is built from the URL and nothing else: `parseInspoLink` from `@tas/domain/angles` is
 * pure and total, so this component never fetches remote metadata, never needs an embed dependency
 * and never has a loading or error state. A string it cannot recognise still comes back with a
 * label, which is why there is no fallback branch here.
 *
 * The whole card is the anchor, it opens in a new tab, and `rel="noreferrer noopener"` keeps the
 * strategist's session out of whatever a pasted URL points at. No directive: it is a plain
 * presentational component, so the panel (a client component) and the `/design-system` page (a
 * server component) can both mount it.
 */
export interface InspoCardProps {
  /** The raw stored string. Parsed here so no caller has to. */
  readonly url: string;
}

export function InspoCard({ url }: InspoCardProps) {
  const link = parseInspoLink(url);

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer noopener"
      title={url}
      data-slot="inspo-card"
      data-kind={link.kind}
      className="flex flex-col gap-1.5 rounded-card border border-line bg-surface2 px-3 py-2.5 transition-colors hover:border-accent-line hover:bg-surface3 focus-visible:border-accent-line focus-visible:outline-none"
    >
      <div className="flex items-center gap-2">
        <span
          data-slot="inspo-source"
          className="inline-flex items-center rounded-input bg-accent-soft px-1.5 py-0.5 font-mono text-[10px] leading-none tracking-wide text-accent uppercase"
        >
          {inspoSourceLabel(link.kind)}
        </span>
        {/* A string that is not a URL parses to an empty host, and an empty span renders nothing. */}
        <span data-slot="inspo-host" className="truncate font-mono text-[11px] text-text3">
          {link.host}
        </span>
      </div>
      <span data-slot="inspo-title" className="truncate text-sm font-medium text-text">
        {link.label}
      </span>
      <span className="truncate font-mono text-[11px] text-text4">{url}</span>
    </a>
  );
}
