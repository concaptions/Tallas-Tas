import type { CreateBriefValues, CreativeBrief } from '@tas/db';
import { BRIEF_CLIENT_STATUS_DEFAULT } from '@tas/db/schema';
import { INTERNAL_ENTRY_STATUS, QA_RESET } from '@tas/domain/state';

/** The managed, identity and propagation columns a copy never inherits. */
const NEVER_COPIED = new Set<keyof CreativeBrief>([
  'id',
  'brandId',
  'createdAt',
  'updatedAt',
  'createdBy',
  'updatedBy',
  'deletedAt',
  'name',
  'briefNumber',
  'nameMode',
  'templateRowId',
  'overriddenFields',
  'legacyAirtableId',
]);

/**
 * What a duplicate stores (scope 3's copy and reset rules): every field of the source, the version
 * one up, the three QA ticks false, the internal track at its ENTRY state (`draft`, the one list's
 * first step for both creative tracks since the Oct 12 consolidation, Ticket 5 / 0067), the
 * client track at its default with no stamp, note, launch or priority. `performance` is the
 * source ad's and is not copied.
 */
export function duplicateValues(source: CreativeBrief): CreateBriefValues {
  const copied: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(source)) {
    if (!NEVER_COPIED.has(key as keyof CreativeBrief)) copied[key] = value;
  }
  return {
    ...(copied as CreateBriefValues),
    version: source.version + 1,
    ...QA_RESET,
    internalStatus: INTERNAL_ENTRY_STATUS,
    clientStatus: BRIEF_CLIENT_STATUS_DEFAULT,
    clientStatusUpdatedAt: null,
    clientStatusNote: null,
    launchedAt: null,
    launchPriority: null,
    performance: null,
  };
}
