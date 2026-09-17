/**
 * The Inspiration section of a Creative Brief (PRD §5.10, ticket criterion 9).
 *
 * `creative_briefs.inspo_links` is a plain jsonb array of strings a strategist pasted out of a
 * browser, so the page has to decide two things about each one: WHAT it is, and whether it can be
 * shown inline. `inspirationLink` answers both — it reuses `parseInspoLink` from `../angles` for the
 * classification (one provider table in the repo, not two) and adds the embed URL that the classifier
 * has no reason to know about.
 *
 * Pure and total. It never throws and never fetches: it reads the URL and nothing else. Anything it
 * cannot recognise, including a string that is not a URL at all, comes back as `provider: 'other'`
 * with `embedUrl: null`, which the page renders as a labelled card — so an unrecognised or malformed
 * URL degrades, never explodes, and the component has one branch (`embedUrl`) rather than five.
 */

import { parseInspoLink, type InspoLinkKind } from '../angles/inspo-links';

/** The providers the strategists actually paste; identical to `InspoLinkKind` by construction. */
export type InspirationProvider = InspoLinkKind;

export interface InspirationLink {
  /** The pasted string, verbatim, for the "open the original" href. */
  readonly url: string;
  readonly provider: InspirationProvider;
  /** The card title: the best name this URL carries, never empty for a non-empty input. */
  readonly label: string;
  /** Hostname without `www.`, for the card's source line. Empty for a string that is not a URL. */
  readonly host: string;
  /** The ad / video / post id, when the shape of the URL names one. */
  readonly id?: string;
  /**
   * The `src` for an inline `<iframe>`, or `null` when this link has to be a card instead.
   *
   * `null` is the ordinary case, not a failure: the Meta Ad Library refuses to be framed at all, and
   * a YouTube or TikTok URL that does not name a video has nothing to embed.
   */
  readonly embedUrl: string | null;
}

/** Sugar for the component: `embeddable` is exactly "there is an `embedUrl`". */
export function isEmbeddable(link: InspirationLink): boolean {
  return link.embedUrl !== null;
}

/**
 * The player URL for each provider that has one.
 *
 * The Meta Ad Library is deliberately absent: it sends `X-Frame-Options`, so an iframe would render
 * a blank box and the card is the honest answer. Instagram serves reels from `/p/<shortcode>/embed`
 * as well as posts, which is why one path covers both.
 */
function embedFor(provider: InspirationProvider, id: string | undefined): string | null {
  if (id === undefined || id === '') {
    return null;
  }
  switch (provider) {
    case 'youtube':
      return `https://www.youtube.com/embed/${id}`;
    case 'tiktok':
      return `https://www.tiktok.com/embed/v2/${id}`;
    case 'instagram':
      return `https://www.instagram.com/p/${id}/embed`;
    case 'meta-ad-library':
    case 'other':
      return null;
  }
}

/**
 * Reads a pasted inspiration URL.
 *
 * `inspirationLink('https://www.youtube.com/watch?v=nm1TxQj9IsQ')` is
 * `{ provider: 'youtube', …, embedUrl: 'https://www.youtube.com/embed/nm1TxQj9IsQ' }`.
 * `inspirationLink('not a url')` is `{ provider: 'other', label: 'not a url', host: '',
 * embedUrl: null }`.
 */
export function inspirationLink(url: string): InspirationLink {
  const parsed = parseInspoLink(url);
  const embedUrl = embedFor(parsed.kind, parsed.id);
  const base = {
    url,
    provider: parsed.kind,
    label: parsed.label,
    host: parsed.host,
    embedUrl,
  };
  return parsed.id === undefined ? base : { ...base, id: parsed.id };
}

/**
 * A whole `inspo_links` array, in the order the strategist pasted it — the order IS the ranking, so
 * nothing here sorts. Blank strings are dropped, because an empty entry has no card to render and
 * the page's empty state should mean "no inspiration", not "one invisible card".
 */
export function inspirationLinks(urls: readonly string[]): readonly InspirationLink[] {
  return urls.filter((url) => url.trim() !== '').map(inspirationLink);
}
