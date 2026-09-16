import { isDemoMode } from '@/lib/demo-mode';
import { loadThemes } from '@/lib/themes-source';

import { categoryFromParam } from './fields';
import { ThemesWorkspace } from './themes-workspace';

/**
 * Themes (PRD §5.5): the GLOBAL creative library, the one table in the platform that is not
 * per-brand.
 *
 * A server component, shaped exactly like the Personas, Products and Angles pages. The rows come
 * from `loadThemes()`, which is the in-repo fixtures in demo mode and the database query otherwise;
 * the page does not know which and does not branch on it. It renders into the shell's `<main>` and
 * therefore owns no frame, padding or background of its own.
 *
 * ONE LOADER, NO BRAND. Every other page resolves the working brand before it reads; this one
 * cannot, because there is nothing to resolve. `listThemes` takes the database alone, the rows
 * carry `brand_id` null, and the grid below is the whole platform's library rather than this
 * workspace's slice of it (CLAUDE.md non-negotiable 3). Do not add a brand filter here: the
 * disconnected per-base Themes table is the Airtable problem this page exists to delete.
 *
 * Both filters are query parameters — `?category=` for the chip row and `?q=` for the search — so
 * a refresh restores the view and either one is shareable. `categoryFromParam` narrows the raw
 * parameter to the known vocabulary here, on the server, so the client component is handed a value
 * it can only render and never a string it has to police.
 *
 * No timestamps are formatted: a theme card carries a usage count rather than a clock, so there is
 * no relative time to keep in step between the server and the client.
 */
interface ThemesPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ThemesPage({ searchParams }: ThemesPageProps) {
  const [{ rows }, params] = await Promise.all([loadThemes(), searchParams]);
  const demo = isDemoMode();

  const requestedCategory = params.category;
  const initialCategory = categoryFromParam(
    typeof requestedCategory === 'string' ? requestedCategory : null,
  );

  const requestedSearch = params.q;
  const initialSearch = typeof requestedSearch === 'string' ? requestedSearch : '';

  return (
    <ThemesWorkspace
      themes={rows}
      demo={demo}
      initialCategory={initialCategory}
      initialSearch={initialSearch}
    />
  );
}
