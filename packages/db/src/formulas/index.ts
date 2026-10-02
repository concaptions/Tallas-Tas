/**
 * THE Airtable formula fields, one exported function per field, transcribed from the Gratsi base's
 * own metadata on 2026-10-02 with every field id resolved to its name
 * (`docs/decisions/formula-policy-2026-10-02.md`).
 *
 * Why they live here and nowhere else: the query layer in `packages/db` is the only place that can
 * see a row's columns AND be imported by every reader, and `@tas/db` may not import `@tas/domain`
 * (CLAUDE.md). Duplicating any of this in a component would let two readings of one record disagree,
 * which is the bug class the one-vocabulary rules exist to prevent. UI code imports these; it never
 * re-implements them.
 *
 * None of these are stored columns. The two that depend on wall-clock time take `now` as an explicit
 * parameter so they stay pure and testable, and so no caller can accidentally snapshot them.
 */
export {
  creatorNotifyFlag,
  emailCampaignCopywritingDueDate,
  emailCampaignDesignDueDate,
  emailFlowCopywritingDueDate,
  emailFlowDesignDueDate,
  smReminderTrigger,
} from './dates';
export { creatorCostWithFee, differenceCpa } from './numbers';
export { campaignOfferName, creativeSheetName } from './names';
