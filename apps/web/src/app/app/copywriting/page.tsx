import { copyTitle } from '@tas/domain/copy';
import { copyStatusLabel, copyStatusTone } from '@tas/domain/state';

import { loadCopyWorkspace } from '@/lib/copy-source';
import { isDemoMode } from '@/lib/demo-mode';
import { absoluteTime, relativeTime } from '@/lib/relative-time';
import { briefPath } from '@/lib/routes';

import { CopywritingWorkspace } from './copywriting-workspace';
import type { CopyItem } from './fields';

/**
 * Copywriting (PRD §5.11): "Ad copy, written separately but tied to the creative. Keep this table
 * lean."
 *
 * A server component, shaped exactly like the Personas, Products, Angles, Themes, Concepts and
 * Creative Briefs pages. The rows come from `loadCopyWorkspace()`, which is the in-repo fixtures in
 * demo mode and the brand-scoped query otherwise; the page does not know which and does not branch
 * on it. It renders into the shell's `<main>` and therefore owns no frame, padding or background of
 * its own.
 *
 * EVERYTHING IS RESOLVED HERE, ONCE. `@/lib/copy-source` imports `@tas/db`, so it can only be read
 * on the server. The auto-generated title is `copyTitle` applied to the stored `copy_number`
 * (CLAUDE.md non-negotiable 4 — it is never an input and never a column), the status label and chip
 * tone are `@tas/domain/state`, and both timestamp strings are formatted here with a single `now`:
 * a client that formatted them itself would render a different string from the server's and break
 * hydration. The client components below receive plain data and never import the database driver.
 *
 * The open row lives in `?copy=` and the search in `?q=`, so both are shareable links. The rows
 * arrive newest edit first from `loadCopyWorkspace()`, so this page never sorts.
 */
interface CopywritingPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CopywritingPage({ searchParams }: CopywritingPageProps) {
  const [{ rows, creatives }, params] = await Promise.all([loadCopyWorkspace(), searchParams]);
  const demo = isDemoMode();
  const now = new Date();

  const items: CopyItem[] = rows.map((row) => ({
    id: row.id,
    title: copyTitle(row.copyNumber),
    headline: row.headline,
    primaryCopy: row.primaryCopy,
    linkDescription: row.linkDescription,
    cta: row.cta,
    status: row.status,
    statusLabel: copyStatusLabel(row.status),
    statusTone: copyStatusTone(row.status),
    creativeBriefId: row.creativeBriefId,
    creativeName: row.creativeName,
    creativeHref: row.creativeBriefId === null ? null : briefPath(row.creativeBriefId),
    funnel: row.funnel,
    used: row.used,
    winning: row.winning,
    metaRating: row.metaRating,
    spellingFeedback: row.spellingFeedback,
    clientComment: row.clientComment,
    updatedLabel: relativeTime(row.updatedAt, now),
    updatedTitle: absoluteTime(row.updatedAt),
  }));

  const requestedSelection = params.copy;
  const selection =
    typeof requestedSelection === 'string' && requestedSelection !== '' ? requestedSelection : null;

  const requestedSearch = params.q;
  const initialSearch = typeof requestedSearch === 'string' ? requestedSearch : '';

  return (
    <CopywritingWorkspace
      items={items}
      creatives={creatives.map((creative) => ({ id: creative.id, name: creative.name }))}
      demo={demo}
      initialSelection={selection}
      initialSearch={initialSearch}
    />
  );
}
