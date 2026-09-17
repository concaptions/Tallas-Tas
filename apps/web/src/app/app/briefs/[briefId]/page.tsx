import { notFound } from 'next/navigation';

import { loadBriefById } from '@/lib/briefs-source';
import { isDemoMode } from '@/lib/demo-mode';
import { conceptPath } from '@/lib/routes';

import { BriefDetail, type BriefConceptCard, type BriefValues } from './brief-detail';

/**
 * One creative brief (PRD §5.10, ticket criteria 3–12). A REAL ROUTE SEGMENT, not a side panel:
 * `/app/briefs/<id>` is the URL you send to the editor who has to cut it, and Back from here
 * restores the list with the `?q=` it was left on.
 *
 * A server component. `loadBriefById` answers `null` for an id that is not a row and this page
 * turns that null into `notFound()` — never a crash, and never an empty three-column shell.
 *
 * Everything the client component needs is handed down as plain data, so it never imports `@tas/db`
 * and the database driver stays out of the browser bundle. That includes the two things only the
 * server can know: which internal TRACK this brief's type is graded on — already carried on the row
 * by `briefs-source`, never recomputed from `'Static'` in a component — and the parent concept's
 * name and batch, which the §7 formula needs to rebuild the name live when the Version changes.
 */
interface BriefPageProps {
  readonly params: Promise<{ briefId: string }>;
}

export default async function BriefPage({ params }: BriefPageProps) {
  const { briefId } = await params;
  const { brief } = await loadBriefById(briefId);
  if (brief === null) {
    notFound();
  }
  const demo = isDemoMode();

  /**
   * The concept card, or `null` for the PRD §8 standalone. `conceptName` is the concept's own
   * generated `Batch-Angle-Theme` name, so the card shows the pairing it already spells out and the
   * name formula takes its segment from the same string.
   */
  const concept: BriefConceptCard | null =
    brief.conceptId === null || brief.conceptName === null
      ? null
      : {
          id: brief.conceptId,
          name: brief.conceptName,
          batch: brief.batch,
          angleName: brief.angleName,
          productName: brief.productName,
          href: conceptPath(brief.conceptId),
        };

  const values: BriefValues = {
    id: brief.id,
    name: brief.name,
    conceptId: brief.conceptId,
    batch: brief.batch,
    funnel: brief.funnel,
    type: brief.type,
    sequence: brief.sequence,
    version: brief.version,
    priority: brief.priority,
    assignee: brief.assignee,
    briefToDesign: brief.briefToDesign,
    scriptContent: brief.scriptContent,
    elementsTested: brief.elementsTested,
    inspoLinks: brief.inspoLinks,
    dimensions: brief.dimensions,
    spellingFeedback: brief.spellingFeedback,
    qaVideoEditor: brief.qaVideoEditor,
    qaDesigner: brief.qaDesigner,
    qaStrategist: brief.qaStrategist,
  };

  return (
    <BriefDetail
      brief={values}
      concept={concept}
      track={brief.track}
      internal={brief.internalStatus}
      client={brief.clientStatus}
      demo={demo}
    />
  );
}
