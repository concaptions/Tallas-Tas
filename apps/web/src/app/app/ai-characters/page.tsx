import { loadAiCharacters } from '@/lib/ai-characters-source';
import { isDemoMode } from '@/lib/demo-mode';
import { absoluteTime, relativeTime } from '@/lib/relative-time';

import { AiCharactersWorkspace, type AiCharacterItem } from './ai-characters-workspace';

/**
 * AI Characters: the persona profiles AI-generated content speaks through.
 *
 * A server component, shaped exactly like the Personas and Products pages. The rows come from
 * `loadAiCharacters()`, which is the in-repo fixtures in demo mode and the brand-scoped database
 * query otherwise; the page does not know which and does not branch on it. Both pieces of table
 * state are query parameters — `?character=` for the open panel and `?q=` for the filter — so a
 * refresh restores the view and either one is shareable as a link. It renders into the shell's
 * `<main>` and therefore owns no frame, padding or background of its own.
 *
 * Relative timestamps are formatted here, once, with a single `now`: a client that formatted them
 * itself would produce a different string from the server's and break hydration.
 */
interface AiCharactersPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AiCharactersPage({ searchParams }: AiCharactersPageProps) {
  const [{ rows }, params] = await Promise.all([loadAiCharacters(), searchParams]);
  const demo = isDemoMode();
  const now = new Date();

  const items: AiCharacterItem[] = rows.map((character) => ({
    character,
    updatedLabel: relativeTime(character.updatedAt, now),
    updatedTitle: absoluteTime(character.updatedAt),
  }));

  const requested = params.character;
  const selection = typeof requested === 'string' && requested !== '' ? requested : null;

  const requestedSearch = params.q;
  const initialSearch = typeof requestedSearch === 'string' ? requestedSearch : '';

  return (
    <AiCharactersWorkspace
      items={items}
      demo={demo}
      initialSelection={selection}
      initialSearch={initialSearch}
    />
  );
}
