import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import {
  CLIENT_TAB_KEYS,
  type ClientTabKey,
  clientTabLabel,
  computeClientProgress,
  isClientTabSlug,
  isTokenExpired,
  mergeCustomPages,
  type ClientProgress,
  type CustomInterfacePageView,
} from '@tas/domain';
import { DEMO_BRAND_ID, demoBriefs, demoConcepts, findTokenByValueAndBrand } from '@tas/db';
import { serverEnv } from '@tas/env';

import { resolveClientBrand } from '@/lib/client-brand-source';
import { getClientToken } from '@/lib/client-auth';
import { loadClientConcepts, loadClientCreatives } from '@/lib/client-data-source';
import { isDemoMode } from '@/lib/demo-mode';
import { loadClientInterfaceConfig } from '@/lib/client-interface-config-source';
import { requestConnection } from '@/lib/request-db';

import { AUX_NAV_ITEMS, auxTabHref, customPageHref, standardTabHref } from '../tabs';

/** The template's rows and the brand's own, the brand winning by slug, in order (raw rows). */
function mergePageRows<Row extends { slug: string; sortOrder: number; title: string }>(
  templateRows: readonly Row[],
  brandRows: readonly Row[],
): Row[] {
  const bySlug = new Map(templateRows.map((row) => [row.slug, row] as const));
  for (const row of brandRows) bySlug.set(row.slug, row);
  return [...bySlug.values()].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title),
  );
}

interface Props {
  readonly children: ReactNode;
  readonly params: Promise<{ brandSlug: string }>;
}

export default async function ClientBrandLayout({ children, params }: Props) {
  const { brandSlug } = await params;
  const brand = await resolveClientBrand(brandSlug);
  if (!brand) notFound();

  // Token gate: in live mode, verify the client has a valid access token for this brand.
  // In demo mode the token check is skipped entirely — there are no credentials to issue.
  if (!isDemoMode()) {
    const token = await getClientToken();
    if (!token) {
      redirect(`/client/${encodeURIComponent(brandSlug)}/auth`);
    }

    const databaseUrl = serverEnv().DATABASE_URL;
    if (databaseUrl !== undefined) {
      const { db, close } = requestConnection(databaseUrl);
      try {
        const row = await findTokenByValueAndBrand(db, token, brand.id);
        if (!row || isTokenExpired(row.expiresAt)) {
          redirect(`/client/${encodeURIComponent(brandSlug)}/auth`);
        }
      } finally {
        await close();
      }
    }
  }

  // Load progress data: demo fixtures in demo mode, client data loaders in live mode.
  let progress: ClientProgress;
  if (isDemoMode()) {
    progress = computeClientProgress({
      concepts: demoConcepts
        .filter((c) => c.brandId === DEMO_BRAND_ID)
        .map((c) => ({ clientStatus: c.clientStatus })),
      briefs: demoBriefs
        .filter((b) => b.brandId === DEMO_BRAND_ID)
        .map((b) => ({ clientStatus: b.clientStatus })),
      // The Creative Sheet is a view over the briefs since the single-source cutover: counting
      // it too would count every creative twice.
      creativeSheet: [],
    });
  } else {
    const [concepts, creatives] = await Promise.all([
      loadClientConcepts(brand.id),
      loadClientCreatives(brand.id),
    ]);
    progress = computeClientProgress({
      concepts: concepts.map((c) => ({ clientStatus: c.clientStatus })),
      briefs: creatives.map((c) => ({ clientStatus: c.clientStatus })),
      creativeSheet: [],
    });
  }

  const config = await loadClientInterfaceConfig(brand.id);
  // The brand's page list (Scope A): the template's rows, the brand's own winning by slug, in
  // order. A STANDARD row (migration 0063) is one of the shipped tabs — concepts, creative_sheet,
  // ugc_management, copywriting, calendar — and only says whether that tab is shown and where.
  const pageRows = mergePageRows(config.templateCustomPages, config.customPages);
  const standardRows = pageRows.filter((row) => row.pageKind === 'standard');
  // Only CUSTOM and MODULE rows are nav entries of their own; a STANDARD row (migration 0063)
  // describes one of the four tabs above, which keep their own routes.
  const customRow = (row: { readonly pageKind: string }) => row.pageKind !== 'standard';
  const mergedPages = mergeCustomPages(
    config.templateCustomPages.filter(customRow).map((row) => ({
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
    config.customPages.filter(customRow).map((row) => ({
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

  // The shipped tabs, in the brand's order, only those visible. Fall back to every tab visible
  // when no standard row exists at all (demo mode, or a database before migration 0063).
  const standardFallback = standardRows.length === 0;
  const standardTabs = standardRows
    .filter((row) => row.isVisible && isClientTabSlug(row.slug))
    .map((row) => ({ tabKey: row.slug as ClientTabKey, sortOrder: row.sortOrder }));
  const calendarRow = standardRows.find((row) => row.slug === 'calendar');
  const auxItems = AUX_NAV_ITEMS.filter(
    (item) => item.segment !== 'calendar' || calendarRow === undefined || calendarRow.isVisible,
  );

  const customTabs = mergedPages.filter((page) => page.isVisible);

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-4 py-8 md:flex-row">
      <aside className="flex shrink-0 flex-col gap-4 md:w-52">
        <div className="flex flex-col gap-1">
          <p className="font-mono text-[11px] tracking-wide text-text3 uppercase">Client Portal</p>
          <p className="text-sm font-semibold text-text">{brand.name}</p>
        </div>
        <div className="flex flex-col gap-1.5" data-slot="campaign-progress">
          <div className="flex items-center gap-3">
            <span className="text-sm text-text3">Campaign Progress</span>
            <span className="font-mono text-sm text-text2">{progress.percentage}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-surface2">
            <div
              className="h-full rounded-full bg-accent transition-all"
              style={{ width: `${String(progress.percentage)}%` }}
            />
          </div>
          <p className="text-[11px] text-text3">
            {progress.approved} of {progress.total} approved
          </p>
        </div>
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
                href={standardTabHref(brandSlug, key)}
                data-slot="standard-tab-link"
                data-tab-key={key}
                className="rounded-input px-3 py-2 text-sm text-text2 transition-colors hover:bg-surface hover:text-text"
              >
                {clientTabLabel(key)}
              </Link>
            );
          })}
          {auxItems.map((item) => (
            <Link
              key={item.segment}
              href={auxTabHref(brandSlug, item.segment)}
              className="rounded-input px-3 py-2 text-sm text-text2 transition-colors hover:bg-surface hover:text-text"
            >
              {item.label}
            </Link>
          ))}
          {customTabs.map((page) => (
            <Link
              key={page.id}
              href={customPageHref(brandSlug, page.slug)}
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
