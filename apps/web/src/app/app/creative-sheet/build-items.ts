import { lookupRollup } from '@tas/db';
import { copyTitle } from '@tas/domain/copy';
import { formatCommentStamp } from '@tas/ui';

import type { CreativeSheetWorkspaceResult } from '@/lib/creative-sheet-source';
import { absoluteTime, relativeTime } from '@/lib/relative-time';

import type { SheetComment, SheetItemView, SheetLookups } from './creative-sheet-workspace';

/**
 * The ONE place a sheet row's twelve `Creative Name` lookups are computed — used by `page.tsx`
 * over the loaders and by the `/design-system` story over fixture-shaped data, so the two cannot
 * drift. A SERVER module on purpose: it calls `lookupRollup` from `@tas/db`, which must never
 * reach a client bundle.
 *
 * The resolution map is the schema's own (`schema/creative-sheet-items.ts`): one hop into the
 * linked brief for `Performance`, `Design File`, `Design Link URL`,
 * `Platform`, `Funnel` and `Type`; one hop further for `(Internal) Product` and `Angle` (the
 * brief's own links, with the concept-inherited name as the fallback `listBriefs` already
 * resolved); two hops for `Concepts (from Angle)` (the concepts whose angle
 * is the brief's) and `Creative Module` (the modules whose briefs include it); and the REVERSE
 * read for `Proposed Copy` — the Meta copy rows whose `creative_brief_id` is the brief, shown by
 * their generated titles (CLAUDE.md non-negotiable 6; `copyTitle`, never typed). A sheet row with
 * no brief resolves every one of them to null — the em dash, the ordinary case.
 */
export function buildSheetItems(
  sources: Pick<
    CreativeSheetWorkspaceResult,
    | 'rows'
    | 'briefLookups'
    | 'angleNames'
    | 'productNames'
    | 'concepts'
    | 'modules'
    | 'copyRows'
    | 'comments'
  >,
  now: Date,
): SheetItemView[] {
  const briefsById = new Map(sources.briefLookups.map((brief) => [brief.id, brief]));
  const angleNamesById = new Map(sources.angleNames.map((angle) => [angle.id, angle.name]));
  const productNamesById = new Map(
    sources.productNames.map((product) => [product.id, product.name]),
  );

  const lookupsFor = (briefId: string | null): SheetLookups => {
    const brief = briefId === null ? undefined : briefsById.get(briefId);
    if (brief === undefined) {
      return {
        concept: null,
        performance: null,
        internalProduct: null,
        angle: null,
        conceptsFromAngle: null,
        designFiles: [],
        designLinkUrl: null,
        platform: null,
        funnel: null,
        type: null,
        proposedCopy: null,
        creativeModule: null,
      };
    }
    const directAngle = brief.angleId === null ? undefined : angleNamesById.get(brief.angleId);
    const directProduct =
      brief.productId === null ? undefined : productNamesById.get(brief.productId);
    const conceptNames =
      brief.angleId === null
        ? []
        : sources.concepts
            .filter((concept) => concept.angleIds.includes(brief.angleId as string))
            .map((concept) => concept.name);
    const moduleNames = sources.modules
      .filter((module) => module.briefIds.includes(brief.id))
      .map((module) => module.name);
    const copyTitles = sources.copyRows
      .filter((copy) => copy.creativeBriefId === brief.id)
      .map((copy) => copyTitle(copy.copyNumber));
    return {
      concept: brief.conceptName,
      performance: lookupRollup([brief.performance]),
      internalProduct: lookupRollup([directProduct ?? brief.productName]),
      angle: lookupRollup([directAngle ?? brief.angleName]),
      conceptsFromAngle: lookupRollup(conceptNames),
      designFiles: brief.designFile ?? [],
      designLinkUrl: lookupRollup([brief.designFileUrl]),
      platform: lookupRollup(brief.platform),
      funnel: lookupRollup([brief.funnel]),
      type: lookupRollup([brief.type]),
      proposedCopy: lookupRollup(copyTitles),
      creativeModule: lookupRollup(moduleNames),
    };
  };

  const commentsByBrief = new Map<string, SheetComment[]>();
  for (const comment of sources.comments) {
    const list = commentsByBrief.get(comment.recordId) ?? [];
    list.push({
      id: comment.id,
      authorName: comment.authorName,
      body: comment.body,
      // The board's `10 Oct, 3:42 PM` beside the author (B1.A21); `ago` stays for the title. Both
      // are computed here, on the server, so the client never formats a time of its own.
      at: formatCommentStamp(comment.createdAt),
      ago: relativeTime(comment.createdAt, now),
    });
    commentsByBrief.set(comment.recordId, list);
  }

  return sources.rows.map((item) => ({
    item,
    lookups: lookupsFor(item.briefId),
    comments: commentsByBrief.get(item.id) ?? [],
    createdLabel: relativeTime(item.createdAt, now),
    createdTitle: absoluteTime(item.createdAt),
    updatedLabel: relativeTime(item.updatedAt, now),
    updatedTitle: absoluteTime(item.updatedAt),
  }));
}
