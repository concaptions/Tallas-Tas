/**
 * Pure types and functions for propagation planning (PRD §5, §14.1; CLAUDE.md non-negotiable 1).
 *
 * A propagation plan describes what the engine will do when a template brand's data changes: for
 * each child brand, which rows to insert, update or skip. The plan is computed here (pure, testable)
 * and executed by `@tas/db/propagation`.
 */

/** What happened to a row in the template that triggered propagation. */
export type PropagationTrigger = 'insert' | 'update' | 'soft_delete';

/** What the engine should do with one child row. */
export type PropagationAction = 'insert' | 'update' | 'skip' | 'soft_delete';

/** One item in a propagation plan: what to do for one child brand. */
export interface PropagationStep {
  readonly childBrandId: string;
  readonly action: PropagationAction;
  readonly reason: string;
}

/** The full plan: what triggered it and what to do for each child. */
export interface PropagationPlan {
  readonly trigger: PropagationTrigger;
  readonly tableName: string;
  readonly templateRowId: string;
  readonly steps: readonly PropagationStep[];
}

/** One completed propagation: what the engine did. */
export interface PropagationOutcome {
  readonly childBrandId: string;
  readonly action: PropagationAction;
  readonly success: boolean;
  readonly error?: string;
}

/**
 * Decide the action for a single child brand given the trigger and whether the child has
 * a local override for the affected fields.
 */
export function decideAction(
  trigger: PropagationTrigger,
  hasLocalOverride: boolean,
): PropagationAction {
  if (hasLocalOverride) return 'skip';
  switch (trigger) {
    case 'insert':
      return 'insert';
    case 'update':
      return 'update';
    case 'soft_delete':
      return 'soft_delete';
  }
}

/**
 * Build a propagation plan for a set of child brands.
 */
export function buildPropagationPlan(
  trigger: PropagationTrigger,
  tableName: string,
  templateRowId: string,
  children: readonly { brandId: string; hasLocalOverride: boolean }[],
): PropagationPlan {
  const steps: PropagationStep[] = children.map((child) => {
    const action = decideAction(trigger, child.hasLocalOverride);
    const reason = action === 'skip' ? 'child has local override' : `propagate ${trigger}`;
    return { childBrandId: child.brandId, action, reason };
  });
  return { trigger, tableName, templateRowId, steps };
}
