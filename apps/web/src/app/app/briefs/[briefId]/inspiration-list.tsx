import { inspirationLinks } from '@tas/domain/creatives';

import { NO_INSPIRATION_NOTE, inspirationSourceLabel } from '../fields';

interface InspirationListProps {
  /** The raw `inspo_links` array, parsed here so no caller has to. */
  readonly urls: readonly string[];
}

/**
 * The Inspiration section (PRD §5.10, ticket criterion 9).
 *
 * Each pasted URL becomes a preview built FROM THE URL AND NOTHING ELSE: `inspirationLink` in
 * `@tas/domain/creatives` is pure and total, so this component never fetches remote metadata, has
 * no loading or error state, and needs no embed dependency. A provider that can be framed renders
 * its own player inline; the Meta Ad Library cannot be framed at all, so it renders as a labelled
 * card — the honest answer rather than a blank box. A string that is not a URL degrades to the same
 * card, which is why there is no fallback branch here and nothing can throw.
 *
 * The iframes are lazy and sandboxed: a brief can carry half a dozen links, and none of them should
 * cost a page load or reach the session that opened them. The original href sits under every
 * preview, framed or not, because the strategist's own source is the thing a reviewer wants.
 *
 * No directive: a plain presentational component, so the detail page (a client component) and the
 * `/design-system` page (a server component) can both mount it.
 */
export function InspirationList({ urls }: InspirationListProps) {
  const links = inspirationLinks(urls);

  if (links.length === 0) {
    return (
      <p data-slot="brief-inspiration-empty" className="text-xs text-text4">
        {NO_INSPIRATION_NOTE}
      </p>
    );
  }

  return (
    <ul data-slot="brief-inspiration-list" className="grid gap-3 sm:grid-cols-2">
      {links.map((link, index) => (
        <li
          key={`${link.url}-${String(index)}`}
          data-slot="inspiration-card"
          data-provider={link.provider}
          data-embeddable={String(link.embedUrl !== null)}
          className="flex min-w-0 flex-col gap-2 rounded-card border border-line bg-surface2 p-2.5"
        >
          <div className="flex items-center gap-2">
            <span
              data-slot="inspiration-source"
              className="inline-flex items-center rounded-input bg-accent-soft px-1.5 py-0.5 font-mono text-[10px] leading-none tracking-wide text-accent uppercase"
            >
              {inspirationSourceLabel(link.provider)}
            </span>
            <span className="truncate font-mono text-[11px] text-text3">{link.host}</span>
          </div>

          {link.embedUrl === null ? null : (
            <iframe
              src={link.embedUrl}
              title={link.label}
              loading="lazy"
              sandbox="allow-scripts allow-same-origin allow-presentation"
              referrerPolicy="no-referrer"
              data-slot="inspiration-embed"
              className="aspect-video w-full rounded-input border border-line bg-surface3"
            />
          )}

          <span
            data-slot="inspiration-title"
            className="line-clamp-2 text-sm font-medium break-words text-text"
          >
            {link.label}
          </span>
          <a
            href={link.url}
            target="_blank"
            rel="noreferrer noopener"
            title={link.url}
            data-slot="inspiration-href"
            className="truncate rounded-input font-mono text-[11px] text-text4 underline-offset-2 hover:text-text2 hover:underline"
          >
            {link.url}
          </a>
        </li>
      ))}
    </ul>
  );
}
