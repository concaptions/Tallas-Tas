import { loadAngles } from '@/lib/angles-source';
import { loadPersonaColumns, loadPersonas } from '@/lib/personas-source';
import { isDemoMode } from '@/lib/demo-mode';
import { loadUserViews } from '@/lib/user-view-actions';
import { absoluteTime, relativeTime } from '@/lib/relative-time';

import { PersonasWorkspace, type PersonaItem } from './personas-workspace';

/**
 * Personas (PRD §5.4): the research table every angle is written from.
 *
 * A server component. The rows come from `loadPersonas()`, which is the in-repo fixtures in demo
 * mode and the brand-scoped database query otherwise; the page does not know which and does not
 * branch on it. The open persona is a query parameter, so a refresh reopens the panel and the URL
 * is shareable. It renders into the shell's `<main>` and therefore owns no frame, padding or
 * background of its own.
 *
 * Relative timestamps are formatted here, once, with a single `now`: a client that formatted them
 * itself would produce a different string from the server's and break hydration.
 *
 * THE COLUMNS ARE DATA. `loadPersonaColumns()` resolves them for the active brand through
 * `resolveColumns(db, brandId, 'personas')`, so the labels, the order and which columns appear at
 * all come from `column_definitions` — the parent template's master set as this brand departs from
 * it — and not from a list in the page. Only the three fields the client needs are forwarded, so the
 * `@tas/db` row type stays on the server.
 *
 * A brand that resolves NO columns is never rendered as a table with no columns: the loader serves
 * the parent master set and sets `unconfigured`, which is forwarded so the workspace can say the
 * columns are a fallback rather than this brand's configuration.
 */
interface PersonasPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function PersonasPage({ searchParams }: PersonasPageProps) {
  const [{ rows }, { rows: angleRows }, { columns: resolved, unconfigured }, params] =
    await Promise.all([loadPersonas(), loadAngles(), loadPersonaColumns(), searchParams]);
  const requestedSearch = params.q;
  const initialSearch = typeof requestedSearch === 'string' ? requestedSearch : '';
  const demo = isDemoMode();
  const userViews = await loadUserViews('personas');
  const now = new Date();

  const items: PersonaItem[] = rows.map((persona) => ({
    persona,
    updatedLabel: relativeTime(persona.updatedAt, now),
    updatedTitle: absoluteTime(persona.updatedAt),
    angleIds: angleRows
      .filter((angle) => angle.personaIds.includes(persona.id))
      .map((angle) => angle.id),
  }));
  const angleOptions = angleRows.map(({ id, name }) => ({ id, name }));
  const columns = resolved.map(({ columnKey, displayLabel, displayOrder }) => ({
    columnKey,
    displayLabel,
    displayOrder,
  }));

  const requested = params.persona;
  const selection = typeof requested === 'string' && requested !== '' ? requested : null;

  return (
    <PersonasWorkspace
      items={items}
      columns={columns}
      demo={demo}
      initialSelection={selection}
      initialSearch={initialSearch}
      userViews={userViews}
      angleOptions={angleOptions}
      unconfiguredColumns={unconfigured}
    />
  );
}
