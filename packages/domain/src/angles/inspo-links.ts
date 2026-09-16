/**
 * Ad Inspiration links (PRD §5.6, "Ad Inspo"). The column is a plain array of strings a strategist
 * pasted out of a browser, so the page has to turn "https://www.tiktok.com/@brand/video/7312…" into
 * something a human recognises at a glance: a source, a title and a hostname.
 *
 * Pure and total. `parseInspoLink` never throws and never fetches — it reads the URL and nothing
 * else. Anything it cannot recognise comes back as `kind: 'other'` with the raw text as the label,
 * so a card always has something to render and the UI never has to branch on failure.
 */

/** The sources the strategists actually paste. Everything else is `other`. */
export type InspoLinkKind = 'meta-ad-library' | 'youtube' | 'tiktok' | 'instagram' | 'other';

export interface InspoLink {
  readonly kind: InspoLinkKind;
  /** The card title: the best name this URL carries, never empty for a non-empty input. */
  readonly label: string;
  /** Hostname without `www.`, for the card's source line. Empty for a string that is not a URL. */
  readonly host: string;
  /** The ad / video / post id, when the shape of the URL names one. */
  readonly id?: string;
}

/** `true` only for `http:` and `https:`. A `mailto:` or `javascript:` string is not a link here. */
export function isHttpUrl(value: string): boolean {
  const url = safeUrl(value);
  return url !== null && (url.protocol === 'http:' || url.protocol === 'https:');
}

function safeUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function hostOf(url: URL): string {
  const host = url.hostname.toLowerCase();
  return host.startsWith('www.') ? host.slice(4) : host;
}

/** `facebook.com` matches `facebook.com` and `m.facebook.com`, never `notfacebook.com`. */
function isHost(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}

/** Path segments with the empties a leading or trailing slash produces removed. */
function segmentsOf(url: URL): string[] {
  return url.pathname.split('/').filter((segment) => segment !== '');
}

function decode(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/** The last path segment, readable; the host when the URL has no path to speak of. */
function fallbackLabel(url: URL, host: string): string {
  const segments = segmentsOf(url);
  const last = segments[segments.length - 1];
  return last === undefined ? host : decode(last);
}

function link(kind: InspoLinkKind, label: string, host: string, id?: string): InspoLink {
  return id === undefined ? { kind, label, host } : { kind, label, host, id };
}

/**
 * Meta's Ad Library: `facebook.com/ads/library/?id=…`. The library also links a whole page with
 * `view_all_page_id`, so either parameter names the thing the strategist meant.
 */
function parseMeta(url: URL, host: string): InspoLink {
  const id = url.searchParams.get('id') ?? url.searchParams.get('view_all_page_id');
  return link(
    'meta-ad-library',
    id ? `Meta Ad Library · ${id}` : 'Meta Ad Library',
    host,
    id ?? undefined,
  );
}

/** `youtube.com/watch?v=…` and the `youtu.be/…` short form. */
function parseYouTube(url: URL, host: string): InspoLink {
  const id = isHost(host, 'youtu.be')
    ? segmentsOf(url)[0]
    : (url.searchParams.get('v') ?? undefined);
  return link('youtube', id ? `YouTube · ${id}` : 'YouTube', host, id);
}

/** `tiktok.com/@handle/video/<id>`. The handle is the useful half of the label. */
function parseTikTok(url: URL, host: string): InspoLink {
  const segments = segmentsOf(url);
  const handle = segments[0]?.startsWith('@') ? segments[0] : undefined;
  const id = segments[1] === 'video' ? segments[2] : undefined;
  return link('tiktok', handle ? `TikTok · ${handle}` : 'TikTok', host, id);
}

/** `instagram.com/p/<shortcode>` and `instagram.com/reel/<shortcode>`. */
function parseInstagram(url: URL, host: string): InspoLink {
  const segments = segmentsOf(url);
  const first = segments[0];
  const id = first === 'p' || first === 'reel' || first === 'reels' ? segments[1] : undefined;
  return link('instagram', id ? `Instagram · ${id}` : 'Instagram', host, id);
}

/**
 * Reads a pasted ad-inspiration URL.
 *
 * `parseInspoLink('https://www.tiktok.com/@brand/video/7312')` is
 * `{ kind: 'tiktok', label: 'TikTok · @brand', host: 'tiktok.com', id: '7312' }`.
 * `parseInspoLink('not a url')` is `{ kind: 'other', label: 'not a url', host: '' }`.
 */
export function parseInspoLink(url: string): InspoLink {
  const parsed = safeUrl(url);
  if (parsed === null || (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')) {
    return { kind: 'other', label: url, host: '' };
  }

  const host = hostOf(parsed);

  if (
    (isHost(host, 'facebook.com') || isHost(host, 'fb.com')) &&
    parsed.pathname.startsWith('/ads/library')
  ) {
    return parseMeta(parsed, host);
  }
  if (isHost(host, 'youtube.com') || isHost(host, 'youtu.be')) {
    return parseYouTube(parsed, host);
  }
  if (isHost(host, 'tiktok.com')) {
    return parseTikTok(parsed, host);
  }
  if (isHost(host, 'instagram.com')) {
    return parseInstagram(parsed, host);
  }

  return { kind: 'other', label: fallbackLabel(parsed, host), host };
}
