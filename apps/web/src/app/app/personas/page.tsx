import { loadPersonas } from '@/lib/personas-source';
import { isDemoMode } from '@/lib/demo-mode';
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
 */
interface PersonasPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function PersonasPage({ searchParams }: PersonasPageProps) {
  const [{ rows }, params] = await Promise.all([loadPersonas(), searchParams]);
  const demo = isDemoMode();
  const now = new Date();

  const items: PersonaItem[] = rows.map((persona) => ({
    persona,
    updatedLabel: relativeTime(persona.updatedAt, now),
    updatedTitle: absoluteTime(persona.updatedAt),
  }));

  const requested = params.persona;
  const selection = typeof requested === 'string' && requested !== '' ? requested : null;

  return <PersonasWorkspace items={items} demo={demo} initialSelection={selection} />;
}
