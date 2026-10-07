import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

import {
  CLIENT_TAB_KEYS,
  type ClientTabKey,
  clientTabLabel,
  mergeCustomPages,
  mergeTabVisibility,
  type CustomInterfacePageView,
  type InterfaceTabVisibilityView,
} from '@tas/domain';
import { computeClientProgress } from '@tas/domain/client-progress';

import { resolveClientBrand } from '@/lib/client-brand-source';
import { loadClientProgressData } from '@/lib/client-data-source';
import { loadClientInterfaceConfig } from '@/lib/client-interface-config-source';

import { ClientProgressBar } from '../client-progress-bar';

interface Props {
  readonly children: ReactNode;
  readonly params: Promise<{ brandSlug: string }>;
}

/**
 * Which URL segment under `/client/<brandSlug>/…` each standard tab points at. The storage key
 * (`CLIENT_TAB_KEYS` in `@tas/domain`) is deliberately different from the route segment on three
 * tabs — the live routes shipped with their own names and are not renamed here (ticket keeps the
 * route tree stable, as the Oct 5 decisions entry says). The map is the one place the two
 * vocabularies meet.
 */
const TAB_HREF_SEGMENT: Readonly<Record<ClientTabKey, string>> = {
  concepts: 'concepts',
  creative_sheet: 'briefs',
  ugc_management: 'ugc',
  copywriting: 'copywriting',
};

/** Non-standard tabs the shipped nav carries — angles / themes / calendar — are shown unconditionally. */
const AUX_NAV_ITEMS = [
  { segment: 'angles', label: 'Angles' },
  { segment: 'themes', label: 'Themes' },
  { segment: 'calendar', label: 'Calendar' },
] as const;

export default async function ClientBrandLayout({ children, params }: Props) {
  const { brandSlug } = await params;
  const brand = await resolveClientBrand(brandSlug);
  if (!brand) notFound();

  const basePath = `/client/${encodeURIComponent(brandSlug)}`;

  const [config, progressData] = await Promise.all([
    loadClientInterfaceConfig(brand.id),
    loadClientProgressData(brand.id),
  ]);
  const progress = computeClientProgress(progressData);
  const mergedTabs = mergeTabVisibility(
    config.templateTabRows.map((row) => ({
      brandId: row.brandId,
      tabKey: row.tabKey as ClientTabKey,
      isVisible: row.isVisible,
      sortOrder: row.sortOrder,
    })) satisfies InterfaceTabVisibilityView[],
    config.tabRows.map((row) => ({
      brandId: row.brandId,
      tabKey: row.tabKey as ClientTabKey,
      isVisible: row.isVisible,
      sortOrder: row.sortOrder,
    })) satisfies InterfaceTabVisibilityView[],
  );
  const mergedPages = mergeCustomPages(
    config.templateCustomPages.map((row) => ({
      id: row.id,
      brandId: row.brandId,
      slug: row.slug,
      title: row.title,
      sourceTableKey: row.sourceTableKey as never,
      filterConfig: row.filterConfig,
      columnConfig: row.columnConfig,
      sortOrder: row.sortOrder,
      isVisible: row.isVisible,
      isInherited: row.isInherited,
    })) satisfies CustomInterfacePageView[],
    config.customPages.map((row) => ({
      id: row.id,
      brandId: row.brandId,
      slug: row.slug,
      title: row.title,
      sourceTableKey: row.sourceTableKey as never,
      filterConfig: row.filterConfig,
      columnConfig: row.columnConfig,
      sortOrder: row.sortOrder,
      isVisible: row.isVisible,
      isInherited: row.isInherited,
    })) satisfies CustomInterfacePageView[],
  );

  // The four shipped tabs — only those marked visible after the merge. Fall back to every tab
  // visible when neither the brand nor the template has configured any row (a brand created
  // before the seed ran).
  const standardTabs = mergedTabs.filter((row) => row.isVisible);
  const standardFallback = standardTabs.length === 0;

  const customTabs = mergedPages.filter((page) => page.isVisible);

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-4 py-8 md:flex-row">
      <aside className="flex shrink-0 flex-col gap-4 md:w-52">
        <div className="flex flex-col gap-1">
          <p className="font-mono text-[11px] tracking-wide text-text3 uppercase">Client Portal</p>
          <p className="text-sm font-semibold text-text">{brand.name}</p>
        </div>
        <ClientProgressBar progress={progress} />
        <nav className="flex flex-row gap-1 overflow-x-auto md:flex-col" data-slot="client-nav">
          {(standardFallback
            ? (CLIENT_TAB_KEYS.map((key) => ({ tabKey: key, sortOrder: 0 })) as readonly {
                tabKey: ClientTabKey;
                sortOrder: number;
              }[])
            : standardTabs
          ).map((row) => {
            const key = row.tabKey;
            return (
              <Link
                key={key}
                href={`${basePath}/${TAB_HREF_SEGMENT[key]}`}
                data-slot="standard-tab-link"
                data-tab-key={key}
                className="rounded-input px-3 py-2 text-sm text-text2 transition-colors hover:bg-surface hover:text-text"
              >
                {clientTabLabel(key)}
              </Link>
            );
          })}
          {AUX_NAV_ITEMS.map((item) => (
            <Link
              key={item.segment}
              href={`${basePath}/${item.segment}`}
              className="rounded-input px-3 py-2 text-sm text-text2 transition-colors hover:bg-surface hover:text-text"
            >
              {item.label}
            </Link>
          ))}
          {customTabs.map((page) => (
            <Link
              key={page.id}
              href={`${basePath}/custom/${page.slug}`}
              data-slot="custom-tab-link"
              data-page-slug={page.slug}
              className="rounded-input px-3 py-2 text-sm text-text2 transition-colors hover:bg-surface hover:text-text"
            >
              {page.title}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="flex min-w-0 flex-1 flex-col gap-6">{children}</main>
    </div>
  );
}
