import { canSeePropagationPage } from '@tas/domain';

import { isDemoMode } from '@/lib/demo-mode';
import { currentTeamActor } from '@/lib/team-actor';
import { loadTeam } from '@/lib/team-source';

import { ColumnAdminWorkspace } from './column-admin-workspace';
import {
  COLUMN_ADMIN_ADMIN_NOTE,
  COLUMN_ADMIN_ENFORCEMENT_NOTE,
  COLUMN_ADMIN_NOT_ADMIN_NOTE,
  DEMO_COLUMN_ADMIN_NOTE,
  toColumnAdminRows,
} from './fields';
import { loadColumnAdmin } from './source';

/**
 * Column Admin (PRD §14.1, "One template, propagated"): the per-column configuration of one table
 * on one base — add, hide, relabel, reorder, detach from the template, reattach to it.
 *
 * A server component. The bases, the tables and the resolved columns come from `loadColumnAdmin`,
 * which is the in-repo column seed in demo mode and the agency-scoped resolver otherwise; the page
 * does not know which and does not branch on it. It renders into the shell's `<main>` and therefore
 * owns no frame, padding or background of its own.
 *
 * ACCESS IS DECIDED HERE, on the server, before a single control reaches the client. The rule is
 * `canSeePropagationPage` from `@tas/domain` — an agency Admin, and strictly nobody else, which is
 * the owner's rule for column structure and the same rule `/app/propagation` enforces for a change
 * that lands in the template. It is deliberately the SAME function the two Server Actions ask
 * again before they write: a hidden control is still a reachable endpoint, so the page gate is the
 * first line and the action's re-check is the one that actually holds.
 *
 * A refused reader gets the rule in words and NO structure controls at all — not disabled ones.
 *
 * The actor is resolved from the session by `currentTeamActor` in live mode and stubbed as an admin
 * in demo mode, where there is no identity provider to ask; the note says the check is stubbed
 * rather than skipped, because it does still run.
 */
export const metadata = {
  title: 'Column Admin — TAS Creative Platform',
};

interface ColumnAdminPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/** Live mode, guard says no: the rule, naming the role that can act. */
function NotAdmin() {
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <p className="font-mono text-[11px] tracking-wide text-text3 uppercase">Settings</p>
        <h1 className="text-2xl font-semibold tracking-tight text-text">Column Admin</h1>
      </header>
      <section
        data-slot="not-admin"
        className="flex max-w-prose flex-col gap-2 rounded-card border border-line bg-surface2 p-6"
      >
        <p className="text-sm font-medium text-text">{COLUMN_ADMIN_NOT_ADMIN_NOTE}</p>
        <p className="text-sm text-text3">{COLUMN_ADMIN_ADMIN_NOTE}</p>
        <p className="text-xs text-text4">{COLUMN_ADMIN_ENFORCEMENT_NOTE}</p>
      </section>
    </div>
  );
}

export default async function ColumnAdminPage({ searchParams }: ColumnAdminPageProps) {
  const params = await searchParams;
  const [{ rows: team }, data] = await Promise.all([
    loadTeam(),
    loadColumnAdmin(params.base, params.table),
  ]);

  if (!canSeePropagationPage(await currentTeamActor(team))) {
    return <NotAdmin />;
  }

  const demo = isDemoMode();
  const isTemplateBase = data.baseId !== null && data.baseId === data.templateBaseId;

  return (
    <ColumnAdminWorkspace
      bases={data.bases}
      tables={data.tables}
      baseId={data.baseId}
      tableKey={data.tableKey}
      isTemplateBase={isTemplateBase}
      rows={toColumnAdminRows(data.columns, isTemplateBase)}
      restorable={data.restorable}
      demo={demo}
      adminNote={COLUMN_ADMIN_ADMIN_NOTE}
      demoNote={demo ? DEMO_COLUMN_ADMIN_NOTE : null}
    />
  );
}
