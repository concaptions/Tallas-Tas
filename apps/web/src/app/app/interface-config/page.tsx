import {
  CUSTOM_PAGE_SOURCE_TABLE_KEYS,
  canConfigureInterface,
  canSeePropagationPage,
  type CustomPageSourceTableKey,
} from '@tas/domain';

import { loadConcepts } from '@/lib/concepts-source';
import { loadInterfaceConfig } from '@/lib/interface-config-source';
import { loadCustomPagesSnapshot } from '@/lib/interface-config-pages-source';
import { isDemoMode } from '@/lib/demo-mode';
import { parentColumnsFor } from '@/lib/resolved-columns-source';
import { currentTeamActor } from '@/lib/team-actor';
import { loadTeam } from '@/lib/team-source';
import { loadClientTokens } from '@/lib/token-source';

import { CustomPagesSection } from './custom-pages-section';
import {
  INTERFACE_CONFIG_ADMIN_NOTE,
  INTERFACE_CONFIG_ENFORCEMENT_NOTE,
  INTERFACE_CONFIG_NOT_ADMIN_NOTE,
  conceptPreview,
} from './fields';
import { InterfaceConfigWorkspace } from './interface-config-workspace';
import { TabVisibilitySection } from './tab-visibility-section';
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
  title: 'Interface Config — TAS Creative Platform',
};

/** Live mode, guard says no. No tree, no preview and no switches — just the rule, in words. */
function NotAdmin() {
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <p className="font-mono text-[11px] tracking-wide text-text3 uppercase">Settings</p>
        <h1 className="text-2xl font-semibold tracking-tight text-text">Interface Config</h1>
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
  const [{ rows }, { rows: concepts }, { rows: team }, snapshot, { tokens }] = await Promise.all([
    loadInterfaceConfig(),
    loadConcepts(),
    loadTeam(),
    loadCustomPagesSnapshot(),
    loadClientTokens(),
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

  const resolverColumnsByTable = CUSTOM_PAGE_SOURCE_TABLE_KEYS.reduce(
    (acc, key) => {
      acc[key] = parentColumnsFor(key).map((col) => ({
        columnKey: col.columnKey,
        displayLabel: col.displayLabel,
      }));
      return acc;
    },
    {} as Record<CustomPageSourceTableKey, readonly { columnKey: string; displayLabel: string }[]>,
  );

  return (
    <div className="flex flex-col gap-8">
      <InterfaceConfigWorkspace
        rows={rows}
        demo={demo}
        concept={newest === undefined ? null : conceptPreview(newest)}
      />
      <TabVisibilitySection
        brandId={snapshot.brandId}
        templateRows={snapshot.tabVisibility
          .filter((row) => row.brandId === snapshot.brandId)
          .map((row) => ({
            brandId: row.brandId,
            tabKey: row.tabKey as never,
            isVisible: row.isVisible,
            sortOrder: row.sortOrder,
          }))}
        brandRows={[]}
        demo={demo}
        disabled={!canConfigureNew}
      />
      <CustomPagesSection
        brandId={snapshot.brandId}
        templatePages={snapshot.templatePages.map((row) => ({
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
        brandPages={snapshot.brandPages.map((row) => ({
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
      <TokenSection
        tokens={tokens.map((t) => ({
          id: t.id,
          email: t.email,
          label: t.label,
          expiresAt: t.expiresAt,
          lastUsedAt: t.lastUsedAt,
          revoked: t.revoked,
          createdAt: t.createdAt,
        }))}
        demo={demo}
        disabled={!canConfigureNew}
      />
    </div>
  );
}
