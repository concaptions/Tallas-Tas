import type { ClientTabKey } from '@tas/domain';

/**
 * Where each client portal tab points, under `/client/<brandSlug>/…` (one place, so the layout and
 * the route-existence test read the same map).
 *
 * The storage key (`CLIENT_TAB_KEYS` in `@tas/domain`) is deliberately different from the route
 * segment on three tabs — the live routes shipped with their own names and are not renamed here
 * (the route tree stays stable, as the Oct 5 decisions entry says). The map is the one place the
 * two vocabularies meet, and `tabs.test.ts` proves every segment here has a `page.tsx` behind it:
 * the Copywriting tab 404'd for three days (2026-10-06 to 09) because its key, label and loader
 * shipped with the interface config while the page under `copywriting/` never did.
 */
export const TAB_HREF_SEGMENT: Readonly<Record<ClientTabKey, string>> = {
  concepts: 'concepts',
  creative_sheet: 'briefs',
  ugc_management: 'ugc',
  copywriting: 'copywriting',
};

/** Non-standard tabs the shipped nav carries — angles / themes / calendar — are shown unconditionally. */
export const AUX_NAV_ITEMS = [
  { segment: 'angles', label: 'Angles' },
  { segment: 'themes', label: 'Themes' },
  { segment: 'calendar', label: 'Calendar' },
] as const;

/** The segment every admin-configured custom page lives under, then its slug. */
export const CUSTOM_PAGE_SEGMENT = 'custom';

/** The portal's base path for a brand; every tab href starts with it. */
export function clientBasePath(brandSlug: string): string {
  return `/client/${encodeURIComponent(brandSlug)}`;
}

export function standardTabHref(brandSlug: string, key: ClientTabKey): string {
  return `${clientBasePath(brandSlug)}/${TAB_HREF_SEGMENT[key]}`;
}

export function auxTabHref(
  brandSlug: string,
  segment: (typeof AUX_NAV_ITEMS)[number]['segment'],
): string {
  return `${clientBasePath(brandSlug)}/${segment}`;
}

export function customPageHref(brandSlug: string, slug: string): string {
  return `${clientBasePath(brandSlug)}/${CUSTOM_PAGE_SEGMENT}/${encodeURIComponent(slug)}`;
}
