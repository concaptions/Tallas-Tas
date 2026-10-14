import {
  CUSTOM_PAGE_SOURCE_TABLE_KEYS,
  STANDARD_PAGE_SOURCE_TABLE,
  canConfigureInterface,
  canSeePropagationPage,
  isStandardPageSlug,
  type CustomPageSourceTableKey,
} from '@tas/domain';
import { isClientVisibleColumn } from '@tas/db';

import { loadConcepts } from '@/lib/concepts-source';
import { loadInterfaceConfig } from '@/lib/interface-config-source';
import { loadBrandTabColumns, loadCustomPagesSnapshot } from '@/lib/interface-config-pages-source';
import { isDemoMode } from '@/lib/demo-mode';
import { parentColumnsFor } from '@/lib/resolved-columns-source';
import { currentTeamActor } from '@/lib/team-actor';
import { loadTeam } from '@/lib/team-source';

import { CustomPagesSection } from './custom-pages-section';
import {
  INTERFACE_CONFIG_ADMIN_NOTE,
  INTERFACE_CONFIG_ENFORCEMENT_NOTE,
  INTERFACE_CONFIG_NOT_ADMIN_NOTE,
  conceptPreview,
} from './fields';
import { InterfaceConfigWorkspace } from './interface-config-workspace';
import { customPageRows, pageListItems } from './page-list-items';
import { PagesSection } from './pages-section';
import { TokenSection } from './token-section';

/**
 * Interface Config (PRD §10): "the interface must be configurable per client, at two levels —
 * which pages appear, and which fields appear".
 *
 * A server component. The configuration comes from `loadInterfaceConfig()` and the concept the
 * preview card renders from `loadConcepts()`; both are the in-repo fixtures in demo mode and the
 * brand-scoped queries otherwise, and this page does not know which and does not branch on it. It
 * renders into the shell's `<main>` and therefore owns no frame, padding or background of its own
 * (ticket criterion 1).
 *
 * ACCESS IS DECIDED HERE (2026-10-03), on the server, before a single switch reaches the client.
 * This page had NO role check of any kind — neither here nor in its Server Action — while
 * `/app/propagation` has both, and what it edits is per-column visibility for the whole brand: who
 * sees what in the client interface. It is the same rule and the same two halves now,
 * `canSeePropagationPage` from `@tas/domain` (an agency Admin, nobody else), asked here and asked
 * again inside `saveInterfaceConfigAction` — a hidden switch is still a reachable endpoint. A
 * refused reader gets the rule in words and no switches at all.
 *
 * The actor is resolved from the session by `currentTeamActor` in live mode and stubbed as an admin
 * in demo mode, where there is no identity provider to ask.
 *
 * THE PREVIEW'S CONCEPT IS PROJECTED HERE, on the server, into plain strings. The preview is a
 * client component, so handing it a `@tas/db` row would pull the database types — and the module
 * that builds a client — towards the browser bundle. `conceptPreview` takes the row and returns the
 * client status chip plus one value per configurable field, and NOTHING internal: no internal
 * status, no budget, no cost, no price (CLAUDE.md non-negotiable 10).
 *
 * The newest concept is the one previewed. It is a picture of the card's SHAPE, not a record the
 * CSM is working on, so which concept fills it does not matter beyond it being a real one.
 */
export const metadata = {
  title: 'Client Interface Configuration — TAS Creative Platform',
};

/** Live mode, guard says no. No tree, no preview and no switches — just the rule, in words. */
function NotAdmin() {
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <p className="font-mono text-[11px] tracking-wide text-text3 uppercase">Settings</p>
        <h1 className="text-2xl font-semibold tracking-tight text-text">
          Client Interface Configuration
        </h1>
      </header>
      <section
        data-slot="not-admin"
        className="flex max-w-prose flex-col gap-2 rounded-card border border-line bg-surface2 p-6"
      >
        <p className="text-sm font-medium text-text">{INTERFACE_CONFIG_NOT_ADMIN_NOTE}</p>
        <p className="text-sm text-text3">{INTERFACE_CONFIG_ADMIN_NOTE}</p>
        <p className="text-xs text-text4">{INTERFACE_CONFIG_ENFORCEMENT_NOTE}</p>
      </section>
    </div>
  );
}

export default async function InterfaceConfigPage() {
  const [{ rows }, { rows: concepts }, { rows: team }, snapshot, tabColumns] = await Promise.all([
    loadInterfaceConfig(),
    loadConcepts(),
    loadTeam(),
    loadCustomPagesSnapshot(),
    loadBrandTabColumns(),
  ]);

  const actor = await currentTeamActor(team);
  // Admin-only sections (page save, shipped PRD §10 config) use the stricter rule, same as before;
  // Admin + CSM may use the two Oct 6/7 sections below. Oct 6/7 Agent 4 widened the surface — the
  // original shipped page already enforced strict Admin, and this preserves that for its payload.
  if (!canSeePropagationPage(actor)) {
    return <NotAdmin />;
  }
  const canConfigureNew = canConfigureInterface(actor);

  const demo = isDemoMode();
  const newest = concepts[0];

  // Every source table a page can render — the custom-page tables and the standard tabs' —
  // narrowed to the client-visible columns (non-negotiable 10); the actions refuse the rest
  // regardless.
  const sourceTables = [
    ...new Set<string>([
      ...CUSTOM_PAGE_SOURCE_TABLE_KEYS,
      ...Object.values(STANDARD_PAGE_SOURCE_TABLE),
    ]),
  ];
  const resolverColumnsByTable = {} as Record<
    CustomPageSourceTableKey,
    readonly { columnKey: string; displayLabel: string }[]
  > &
    Record<string, readonly { columnKey: string; displayLabel: string }[]>;
  for (const key of sourceTables) {
    resolverColumnsByTable[key] = parentColumnsFor(key)
      .filter((col) => isClientVisibleColumn(key, col.columnKey))
      .map((col) => ({ columnKey: col.columnKey, displayLabel: col.displayLabel }));
  }

  // A standard tab's Edit dialog pre-fills from the brand's effective columns (Part A2): the shown
  // ones as picks in the brand's order under the brand's labels; the hidden ones come unticked.
  const pages = pageListItems(snapshot.templatePages, snapshot.brandPages).map((item) =>
    item.kind === 'standard' && isStandardPageSlug(item.slug)
      ? {
          ...item,
          sourceTableKey: STANDARD_PAGE_SOURCE_TABLE[item.slug],
          columnConfig: tabColumns[item.slug]
            .filter((column) => !column.hidden)
            .map((column, index) => ({
              columnKey: column.columnKey,
              displayLabel: column.label,
              displayOrder: index,
            })),
        }
      : item,
  );

  return (
    <div className="flex flex-col gap-8">
      <InterfaceConfigWorkspace
        rows={rows}
        demo={demo}
        concept={newest === undefined ? null : conceptPreview(newest)}
      />
      <PagesSection
        pages={pages}
        resolverColumnsByTable={resolverColumnsByTable}
        demo={demo}
        disabled={!canConfigureNew}
        canPush={canSeePropagationPage(actor)}
      />
      <CustomPagesSection
        brandId={snapshot.brandId}
        templatePages={customPageRows(snapshot.templatePages).map((row) => ({
          id: row.id,
          brandId: row.brandId,
          slug: row.slug,
          title: row.title,
          sourceTableKey: row.sourceTableKey as CustomPageSourceTableKey,
          filterConfig: row.filterConfig,
          columnConfig: row.columnConfig,
          sortOrder: row.sortOrder,
          isVisible: row.isVisible,
          isInherited: row.isInherited,
        }))}
        brandPages={customPageRows(snapshot.brandPages).map((row) => ({
          id: row.id,
          brandId: row.brandId,
          slug: row.slug,
          title: row.title,
          sourceTableKey: row.sourceTableKey as CustomPageSourceTableKey,
          filterConfig: row.filterConfig,
          columnConfig: row.columnConfig,
          sortOrder: row.sortOrder,
          isVisible: row.isVisible,
          isInherited: row.isInherited,
        }))}
        resolverColumnsByTable={resolverColumnsByTable}
        demo={demo}
        disabled={!canConfigureNew}
      />
      {snapshot.brandId !== null ? <TokenSection brandId={snapshot.brandId} demo={demo} /> : null}
    </div>
  );
}
