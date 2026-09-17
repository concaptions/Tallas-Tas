/**
 * Who may settle a promotion request (PRD §5, ticket `propagation` criterion 3).
 *
 * §5 is unambiguous about where a request lands: "request comes in to the ADMIN dashboard to approve
 * everything." Not the CSM who runs the brand, not the strategist who made the change — the agency
 * admin, because a promotion writes into the TEMPLATE and every other brand inherits the result. A
 * person who can only see one brand cannot be the one to change all of them.
 *
 * ONE RULE, TWO NAMES, ONE IMPLEMENTATION. `canSeePropagationPage` in `../team/access` is the body;
 * this is the name the review path calls it by. They are deliberately the same predicate and not two
 * that happen to agree: `/app/propagation` has nothing on it except the pending queue and the
 * Approve/Reject buttons that settle it, so somebody who may not approve has nothing to look at, and
 * a build where the page opened wider than the buttons would be a page that renders a control it
 * refuses to honour. Keeping one function under the guard means the page and the Server Action can
 * never drift apart — which is the whole point of criterion 3's "admin only is enforced, not just
 * written".
 *
 * The body lives in `team/access.ts` rather than here because that is where `TeamPageActor` and the
 * repo's other access rules are, and importing the type from there while exporting the predicate
 * back would be a cycle. The edge runs one way: `propagation -> team`, never the reverse.
 *
 * PURE AND SESSION-FREE, like every guard in this package: the actor is a parameter, nothing here
 * reads a cookie or calls Clerk, and demo mode gets its answer by handing this an admin actor
 * (`DEMO_TEAM_ACTOR`) rather than by skipping the check.
 */

import { canSeePropagationPage, type TeamPageActor } from '../team/access';

/**
 * What the guard needs to know about the person acting. The same narrow actor the Team page uses,
 * aliased so a caller in the review path does not have to import a type named for another page.
 */
export type PromotionReviewer = TeamPageActor;

/**
 * True only for an agency admin. A CSM, a strategist, a designer, a media buyer, a client, an actor
 * that could not be resolved and an empty actor are all false.
 *
 * Note this is STRICTER than `canSeeTeamPage`, which also admits a CSM: a CSM works across the whole
 * client base and belongs on the roster page, but §5 gives the approval to the admin alone, and
 * "approving a change to every brand's template" is not a client-success job. The two guards
 * deliberately disagree, and this file is where the disagreement is written down.
 */
export function canReviewPromotion(actor: PromotionReviewer | null | undefined): boolean {
  return canSeePropagationPage(actor);
}
