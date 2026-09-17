import { loadBriefs } from '@/lib/briefs-source';
import { isDemoMode } from '@/lib/demo-mode';
import { briefPath } from '@/lib/routes';

import { BriefsWorkspace } from './briefs-workspace';
import { creativeTypeLabel, internalStatusView, priorityView, type BriefItem } from './fields';

/**
 * Creative Briefs (PRD §5.10): one record per creative asset, named by the §7 formula and never
 * typed by hand.
 *
 * A server component, shaped exactly like the Concepts, Personas, Products, Angles and Themes
 * pages. The rows come from `loadBriefs()`, which is the in-repo fixtures in demo mode and the
 * brand-scoped query otherwise; the page does not know which and does not branch on it. It renders
 * into the shell's `<main>` and therefore owns no frame, padding or background of its own.
 *
 * EVERY STATUS IS RESOLVED HERE, ONCE. `@/lib/briefs-source` imports `@tas/db`, so it can only be
 * read on the server; each row already carries the TRACK its type is graded on, so the label and
 * the chip tone are looked up through `@tas/domain/state` here and handed down on a `BriefItem`.
 * That is what keeps the database driver out of the browser bundle AND keeps every status decision
 * in one module — the client component below never compares a status to a literal and never
 * branches on `'Static'`.
 *
 * The search lives in `?q=`, the same key every other list page uses, so a narrowed list is a link
 * someone can send. The rows arrive newest edit first from `loadBriefs()`, so this page never sorts.
 */
interface BriefsPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function BriefsPage({ searchParams }: BriefsPageProps) {
  const [{ rows }, params] = await Promise.all([loadBriefs(), searchParams]);
  const demo = isDemoMode();

  const items: BriefItem[] = rows.map((row) => ({
    id: row.id,
    name: row.name,
    conceptName: row.conceptName,
    type: row.type,
    typeLabel: creativeTypeLabel(row.type),
    priority: priorityView(row.priority),
    assignee: row.assignee,
    status: internalStatusView(row.track, row.internalStatus),
    href: briefPath(row.id),
  }));

  const requestedSearch = params.q;
  const initialSearch = typeof requestedSearch === 'string' ? requestedSearch : '';

  return <BriefsWorkspace items={items} demo={demo} initialSearch={initialSearch} />;
}
