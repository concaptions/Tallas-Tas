import { notFound } from 'next/navigation';

import { copyStatusLabel, copyStatusTone } from '@tas/domain/state';

import { loadAssets } from '@/lib/assets-source';
import { loadBriefById } from '@/lib/briefs-source';
import { loadClientAssetFolders } from '@/lib/client-assets-source';
import { loadCollections } from '@/lib/collections-source';
import { loadConcepts } from '@/lib/concepts-source';
import { loadCopy } from '@/lib/copy-source';
import { loadCreativeModules } from '@/lib/creative-modules-source';
import { loadCreativeReports } from '@/lib/creative-reporting-source';
import { loadCreativeSheetItems } from '@/lib/creative-sheet-source';
import { isDemoMode } from '@/lib/demo-mode';
import { conceptPath } from '@/lib/routes';

import { briefLinkedRecords } from '../fields';
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
  const [
    { brief },
    conceptRows,
    collectionRows,
    assetRows,
    copyRows,
    sheetItems,
    modules,
    folders,
    reports,
  ] = await Promise.all([
    loadBriefById(briefId),
    loadConcepts(),
    loadCollections(),
    loadAssets(),
    loadCopy(),
    // The four tables that point at a brief (module parity, phase 2), each through its own
    // demo-aware `load…`, so the rail reads the fixtures' link arrays and a seeded database's
    // junctions through one branch.
    loadCreativeSheetItems(),
    loadCreativeModules(),
    loadClientAssetFolders(),
    loadCreativeReports(),
  ]);
  if (brief === null) {
    notFound();
  }
  const demo = isDemoMode();

  // Indexed by the junction here, on the server; the rail renders plain records with their hrefs.
  const linked = briefLinkedRecords(brief.id, {
    sheetItems: sheetItems.rows,
    modules: modules.rows,
    folders: folders.rows,
    reports: reports.rows,
  });

  // TABLE 7 parity (TASK 8): the linked collection's and asset's names, and the Meta Copywriting
  // rows whose creative_brief_id points here — all resolved on the server, views precomputed.
  const collectionName =
    brief.collectionId === null
      ? null
      : (collectionRows.rows.find((row) => row.id === brief.collectionId)?.name ?? null);
  const assetName =
    brief.assetId === null
      ? null
      : (assetRows.rows.find((row) => row.id === brief.assetId)?.filename ?? null);
  const copyLinks = copyRows.rows
    .filter((row) => row.creativeBriefId === brief.id)
    .map((row) => ({
      id: row.id,
      label: row.headline ?? row.primaryCopy ?? 'Untitled copy',
      statusLabel: copyStatusLabel(row.status),
      statusTone: copyStatusTone(row.status),
    }));

  // Every concept of the brand, so the detail can move a brief between concepts (TASK 5). The
  // save recomputes the generated name from whichever concept is chosen.
  const conceptOptions = conceptRows.rows.map((row) => ({ id: row.id, name: row.name }));

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
    source: brief.source,
    conceptId: brief.conceptId,
    designFileUrl: brief.designFileUrl,
    platform: brief.platform,
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
    angleId: brief.angleId,
    productId: brief.productId,
    spellingFeedback2: brief.spellingFeedback2,
    clickForAiSpellChecker: brief.clickForAiSpellChecker,
    adContent: brief.adContent,
    inspiration: brief.inspiration,
    inspirationImage: brief.inspirationImage,
    qaChecklistDoc: brief.qaChecklistDoc,
    designFile: brief.designFile,
    scriptAndBriefBreakdown: brief.scriptAndBriefBreakdown,
    language: brief.language,
    offer: brief.offer,
    qaVideoEditor: brief.qaVideoEditor,
    qaDesigner: brief.qaDesigner,
    qaStrategist: brief.qaStrategist,
  };

  return (
    <BriefDetail
      brief={values}
      concept={concept}
      conceptOptions={conceptOptions}
      collectionName={collectionName}
      assetName={assetName}
      copyLinks={copyLinks}
      linked={linked}
      track={brief.track}
      internal={brief.internalStatus}
      client={brief.clientStatus}
      demo={demo}
    />
  );
}
