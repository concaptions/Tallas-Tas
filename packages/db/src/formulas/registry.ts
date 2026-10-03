// Imported from the CONCRETE modules, never from `./index`: the barrel re-exports this file, so
// importing the barrel here would make the cycle index -> registry -> index. It resolves at runtime
// because function declarations hoist, but a cycle through a barrel is exactly the kind of thing
// that makes a bundler's module graph unpredictable, and there is no reason to have one.
import {
  creatorNotifyFlag,
  emailCampaignCopywritingDueDate,
  emailCampaignDesignDueDate,
  emailFlowCopywritingDueDate,
  emailFlowDesignDueDate,
  smReminderTrigger,
} from './dates';
import { campaignOfferName, creativeSheetName } from './names';
import { creatorCostWithFee, differenceCpa } from './numbers';

/**
 * THE formulas a `column_definitions` row may name, by name.
 *
 * A virtual column stores the NAME of its formula, not a function — a database row cannot hold a
 * closure — so something has to turn that string back into a guarantee. This is it: a seeded name
 * that is not a key here is caught by the seed's gate rather than discovered when a page renders
 * nothing. Free text in the `formula` column would make a typo invisible until someone opened the
 * page.
 *
 * The signatures are deliberately NOT unified. These functions take what each field actually
 * depends on — a send date, a due date and `now`, a brief name and a timestamp — and flattening them
 * behind one row-shaped interface would mean every caller handing over a whole row and every formula
 * reaching into it, which is how a pure function stops being testable. A page imports the function
 * it needs and calls it directly, exactly as it did before virtual columns existed; the registry
 * exists so the NAME can be validated and so "which formula backs this column" is answerable from
 * the configuration alone.
 *
 * `creatorCostWithFee`, `creatorNotifyFlag` and `campaignOfferName` are listed although no column
 * names them yet. They are formulas of the same kind, and a registry that only contained the ones
 * already configured would have to be edited twice to add a column.
 */
export const VIRTUAL_FORMULAS = {
  campaignOfferName,
  creativeSheetName,
  creatorCostWithFee,
  creatorNotifyFlag,
  differenceCpa,
  emailCampaignCopywritingDueDate,
  emailCampaignDesignDueDate,
  emailFlowCopywritingDueDate,
  emailFlowDesignDueDate,
  smReminderTrigger,
} as const;

/** The name of a formula a virtual column may be backed by. */
export type VirtualFormulaName = keyof typeof VIRTUAL_FORMULAS;

const NAMES = new Set<string>(Object.keys(VIRTUAL_FORMULAS));

/** Whether `name` is a formula this platform actually exports. The seed's gate asks this. */
export function isVirtualFormulaName(name: string): name is VirtualFormulaName {
  return NAMES.has(name);
}

/** Every formula name, for a test or an admin screen that needs to offer the list. */
export function virtualFormulaNames(): readonly VirtualFormulaName[] {
  return Object.keys(VIRTUAL_FORMULAS).sort() as VirtualFormulaName[];
}
