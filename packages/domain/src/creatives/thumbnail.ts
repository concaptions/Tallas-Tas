/**
 * The Internal Queue card's thumbnail (ticket `internal-queue` criterion 5).
 *
 * A queue card needs something to look at before it needs anything to read, but the fixtures carry
 * no image: `creative_briefs` stores a `design_file_url` that points at a review tool behind a login
 * and an `inspo_links` array of pasted browser URLs. Fetching either would mean a network call, a
 * login, an oEmbed key and a loading state on a board that is meant to be scanned — and criterion 5
 * forbids adding a fixture column for it.
 *
 * So the thumbnail is a LABELLED TILE, decided here and drawn by the component entirely from the
 * token layer: no image is fetched, nothing is measured, and a malformed or absent URL degrades to
 * the tile rather than throwing. The classification is `inspirationLink`'s — one provider table in
 * the repo, not two — and the only thing this module adds is the short word a small square has room
 * for, which is a presentation concern `inspiration.ts` has no reason to carry.
 *
 * Pure and total.
 */

import { inspirationLink, type InspirationProvider } from './inspiration';
import { isHttpUrl } from '../angles/inspo-links';

export interface BriefThumbnailInput {
  /** The §7 creative name. The fallback tile is its leading token, so it is the one required field. */
  readonly name: string;
  /** `creative_briefs.design_file_url`; nullable, and often a host with no provider. */
  readonly designFileUrl?: string | null;
  /** `creative_briefs.inspo_links`; never null in the schema, frequently empty. */
  readonly inspoLinks?: readonly string[] | null;
}

/**
 * Which of the three sources the tile came from, so the card can style the design-file tile
 * differently from a borrowed reference without re-deriving why.
 */
export type BriefThumbnailSource = 'design-file' | 'inspiration' | 'name';

export interface BriefThumbnail {
  readonly source: BriefThumbnailSource;
  /** The word drawn in the tile: `YouTube`, `Meta`, a bare host, or the name's leading token. */
  readonly label: string;
  /** `null` exactly when `source` is `'name'` — there was no link to classify. */
  readonly provider: InspirationProvider | null;
  /** The link the tile stands for, verbatim, for a title attribute. Never fetched. */
  readonly url: string | null;
  /** The tile's accessible description. Never empty. */
  readonly alt: string;
}

/**
 * The short word for each provider.
 *
 * `inspirationLink().label` is the CARD title — `YouTube · nm1TxQj9IsQ`, `TikTok · @brand` — which is
 * right for a 320px inspiration card and far too long for a 48px tile. `other` is empty on purpose:
 * an unrecognised link has no provider word, so the tile falls back to the link's own host, which is
 * what makes a `frame.example` design file read as `frame.example` rather than as `Other`.
 */
const PROVIDER_TILE_LABELS: Readonly<Record<InspirationProvider, string>> = {
  'meta-ad-library': 'Meta',
  youtube: 'YouTube',
  tiktok: 'TikTok',
  instagram: 'Instagram',
  other: '',
};

/** The tile a brief with nothing to show falls back to. Matches the em dash `fields.ts` renders. */
const EMPTY_TILE_LABEL = '—';

/**
 * The name's leading token: `TV1` out of `TV1-B1-Your Body Clock Is Not Broken-Problem/Solution-V2`.
 *
 * PRD §7 puts the funnel letter, the format letter and the sequence number first, so the leading
 * token is the one part of a generated name that is short, unique within a batch and meaningful at a
 * glance. Split on anything that is not alphanumeric, so a hand-typed legacy name still yields a
 * token, and cap it at four characters so the tile never has to shrink its type.
 */
export function creativeNameToken(name: string): string {
  const first = name.split(/[^A-Za-z0-9]+/).find((part) => part !== '');
  return first === undefined ? EMPTY_TILE_LABEL : first.toUpperCase().slice(0, 4);
}

/** The first entry that is an actual http(s) link; `undefined` for an empty or junk-only array. */
function firstLink(urls: readonly string[] | null | undefined): string | undefined {
  return (urls ?? []).find((url) => isHttpUrl(url));
}

function fromLink(
  url: string,
  source: 'design-file' | 'inspiration',
  name: string,
): BriefThumbnail {
  const link = inspirationLink(url);
  const word = PROVIDER_TILE_LABELS[link.provider];
  const label = word !== '' ? word : link.host !== '' ? link.host : creativeNameToken(name);
  const what = source === 'design-file' ? 'Design file' : 'Ad inspiration';
  return {
    source,
    label,
    provider: link.provider,
    url,
    alt: `${what} for ${name} on ${label}`,
  };
}

/**
 * The tile for one brief.
 *
 * The design file wins when there is one: it points at the creative ITSELF, where an inspo link only
 * points at what the creative was argued from. An inspiration link is the second choice, and the
 * name's leading token is the floor — there is always a name, so there is always a tile.
 *
 * `briefThumbnail({ name: 'TV1-B1-…-V2', designFileUrl: null, inspoLinks: ['https://www.youtube.com/watch?v=x'] })`
 * is `{ source: 'inspiration', label: 'YouTube', provider: 'youtube', … }`.
 * `briefThumbnail({ name: 'TV1-B1-…-V2', designFileUrl: null, inspoLinks: [] })`
 * is `{ source: 'name', label: 'TV1', provider: null, url: null, … }`.
 */
export function briefThumbnail(input: BriefThumbnailInput): BriefThumbnail {
  const { name } = input;
  const designFileUrl = input.designFileUrl ?? '';
  if (isHttpUrl(designFileUrl)) {
    return fromLink(designFileUrl, 'design-file', name);
  }

  const inspo = firstLink(input.inspoLinks);
  if (inspo !== undefined) {
    return fromLink(inspo, 'inspiration', name);
  }

  const label = creativeNameToken(name);
  return {
    source: 'name',
    label,
    provider: null,
    url: null,
    alt: name.trim() === '' ? 'Creative with no name, no design file and no inspiration' : name,
  };
}
