import { desc, eq, isNull } from 'drizzle-orm';

import type { Db } from './db';
import {
  campaignsOffers,
  emailFlowCampaigns,
  emailFlows,
  users,
  type EmailFlow,
  type NewEmailFlow,
} from './schema';
import { withBrand, type BrandScope } from './tenancy';

/**
 * The Email Flows page's data access (Airtable "Email Flows Management", `tblubVflAQZgJSxcF`; audit
 * `docs/audits/airtable-module-gap-2026-10-01.md` §2.11). A copy of `products.ts`, function for
 * function: every function takes the database as its first argument (no module-level singleton) and
 * reads and writes through `withBrand(db, brandId)`, so `brand_id = $brandId AND deleted_at IS NULL`
 * is on every statement and an insert cannot choose its own brand. Nothing here contains business
 * logic; the Server Actions call these.
 */

/** The columns the scope, the clock and the actor own; a caller never sets them. */
type ManagedColumn =
  'id' | 'brandId' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy' | 'deletedAt';

/** What a form or a parsed CSV row submits for create (`flowName` required), or patches. */
export type EmailFlowInput = Omit<NewEmailFlow, ManagedColumn>;

/**
 * An email flow as the list and the panel render it: the stored row plus what the base shows as
 * links, lookups and formulas, all computed here in TypeScript and never stored:
 *
 * - `campaignIds` / `campaignNames` — the "Campaigns & Offers" multi-link, read from the
 *   `email_flow_campaigns` junction and narrowed to the brand's LIVE campaigns, alphabetical by
 *   campaign name (both arrays in the same order, so index `i` of one is index `i` of the other);
 * - `assigneeName` — the "Assignee" collaborator's full name, looked up from the global `users`
 *   table by the Clerk id `assignee_id` stores, or null when unassigned or unknown;
 * - `designDueDate` / `copywritingDueDate` — the two base formulas, `emailFlowDueDates` below.
 *
 * `demoEmailFlows` satisfies `EmailFlowListRow[]`, so the page reads demo fixtures and database rows
 * through one type.
 */
export type EmailFlowListRow = EmailFlow & {
  campaignIds: string[];
  campaignNames: string[];
  assigneeName: string | null;
  designDueDate: string | null;
  copywritingDueDate: string | null;
};

/** The two formula fields of the base, derived from "Expected Setup Date" and never stored. */
export interface EmailFlowDueDates {
  readonly designDueDate: string | null;
  readonly copywritingDueDate: string | null;
}

const DAY_MS = 86_400_000;
/** "Design Due Date" = `DATEADD({Expected Setup Date}, -5, 'days')`. */
const DESIGN_DUE_OFFSET_DAYS = 5;
/** "Copywriting Due Date" = `DATEADD({Design Due Date}, -5, 'days')`, i.e. setup − 10 days. */
const COPYWRITING_DUE_OFFSET_DAYS = DESIGN_DUE_OFFSET_DAYS + 5;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * `isoDate` shifted by `days`, in UTC so a calendar date never slides across a DST boundary or the
 * server's timezone. A value that is not a calendar date yields null rather than "Invalid Date".
 */
function shiftIsoDate(isoDate: string, days: number): string | null {
  if (!ISO_DATE.test(isoDate)) return null;
  const time = Date.parse(`${isoDate}T00:00:00.000Z`);
  if (Number.isNaN(time)) return null;
  return new Date(time + days * DAY_MS).toISOString().slice(0, 10);
}

/**
 * The base's two formula columns for one flow: design is due five days before the expected setup,
 * copywriting five days before that. Pure, so the fixtures, the query layer and a test agree.
 */
export function emailFlowDueDates(expectedSetupDate: string | null): EmailFlowDueDates {
  if (expectedSetupDate === null) {
    return { designDueDate: null, copywritingDueDate: null };
  }
  return {
    designDueDate: shiftIsoDate(expectedSetupDate, -DESIGN_DUE_OFFSET_DAYS),
    copywritingDueDate: shiftIsoDate(expectedSetupDate, -COPYWRITING_DUE_OFFSET_DAYS),
  };
}

// ── Email flow ↔ Campaigns & Offers ───────────────────────────────────────────────────────

/** The campaign ids one flow links to, straight from the junction (no brand filter: ids only). */
export async function listEmailFlowCampaignIds(db: Db, emailFlowId: string): Promise<string[]> {
  const rows = await db
    .select({ campaignOfferId: emailFlowCampaigns.campaignOfferId })
    .from(emailFlowCampaigns)
    .where(eq(emailFlowCampaigns.emailFlowId, emailFlowId));
  return rows.map((row) => row.campaignOfferId);
}

/**
 * Replaces one flow's "Campaigns & Offers" links: delete-then-insert, the `junction-queries.ts`
 * shape, with the brand scope in front of it. The flow must be a live row of `brandId` (another
 * brand's id, or a soft-deleted flow, changes nothing and returns false) and every campaign id is
 * narrowed to the brand's live campaigns, so a form cannot link a flow to another brand's offer.
 * Duplicates collapse, because the junction's primary key would reject them.
 */
export async function syncEmailFlowCampaigns(
  db: Db,
  brandId: string,
  emailFlowId: string,
  campaignOfferIds: readonly string[],
): Promise<boolean> {
  const scope = withBrand(db, brandId);
  const [flow] = await scope.select(emailFlows, eq(emailFlows.id, emailFlowId)).limit(1);
  if (flow === undefined) return false;
  const brandCampaigns = await scope.select(campaignsOffers);
  const allowed = new Set(brandCampaigns.map((campaign) => campaign.id));
  const ids = [...new Set(campaignOfferIds)].filter((id) => allowed.has(id));
  await db.delete(emailFlowCampaigns).where(eq(emailFlowCampaigns.emailFlowId, emailFlowId));
  if (ids.length > 0) {
    await db
      .insert(emailFlowCampaigns)
      .values(ids.map((campaignOfferId) => ({ emailFlowId, campaignOfferId })));
  }
  return true;
}

/** `emailFlowId -> campaignOfferId[]` for every junction row, loaded once for a list view. */
export async function loadAllEmailFlowCampaigns(db: Db): Promise<Map<string, string[]>> {
  const rows = await db.select().from(emailFlowCampaigns);
  const map = new Map<string, string[]>();
  for (const row of rows) {
    const existing = map.get(row.emailFlowId);
    if (existing) existing.push(row.campaignOfferId);
    else map.set(row.emailFlowId, [row.campaignOfferId]);
  }
  return map;
}

// ── List rows ─────────────────────────────────────────────────────────────────────────────

interface LinkedWork {
  /** The brand's live campaigns, alphabetical by name, so every flow lists its links in one order. */
  campaigns: { id: string; name: string }[];
  /** emailFlowId -> the campaign ids its junction rows point at (any brand; filtered on use). */
  junction: Map<string, string[]>;
  /** Clerk user id -> full name, for the "Assignee" collaborator. */
  assignees: Map<string, string>;
}

/**
 * Everything a list row needs beyond its own columns, loaded in bulk. The campaigns come through
 * the scope (they are the brand's), the junction is read whole (it carries no brand of its own), and
 * `users` is read directly because it is a GLOBAL table — `brand_id` is null on every row — so
 * `withBrand` cannot reach it. The join happens here rather than in SQL because `withBrand` hands
 * back a sealed query surface with no join (TICKET-005 round 3), the guarantee that a scoped read
 * cannot be widened.
 */
async function linkedWork(db: Db, scope: BrandScope): Promise<LinkedWork> {
  const [brandCampaigns, junction, people] = await Promise.all([
    scope.select(campaignsOffers),
    loadAllEmailFlowCampaigns(db),
    db
      .select({ clerkUserId: users.clerkUserId, fullName: users.fullName })
      .from(users)
      .where(isNull(users.deletedAt)),
  ]);
  // Alphabetical, because the scoped read carries no ORDER BY and heap order is not a contract.
  const campaigns = brandCampaigns
    .map(({ id, name }) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const assignees = new Map(people.map((person) => [person.clerkUserId, person.fullName]));
  return { campaigns, junction, assignees };
}

function decorate(row: EmailFlow, linked: LinkedWork): EmailFlowListRow {
  const linkedIds = new Set(linked.junction.get(row.id) ?? []);
  const campaigns = linked.campaigns.filter((campaign) => linkedIds.has(campaign.id));
  return {
    ...row,
    campaignIds: campaigns.map((campaign) => campaign.id),
    campaignNames: campaigns.map((campaign) => campaign.name),
    assigneeName: row.assigneeId === null ? null : (linked.assignees.get(row.assigneeId) ?? null),
    ...emailFlowDueDates(row.expectedSetupDate),
  };
}

/** The brand's live email flows, newest edit first, each with its links, assignee and due dates. */
export async function listEmailFlows(db: Db, brandId: string): Promise<EmailFlowListRow[]> {
  const scope = withBrand(db, brandId);
  const [rows, linked] = await Promise.all([
    scope.select(emailFlows).orderBy(desc(emailFlows.updatedAt)),
    linkedWork(db, scope),
  ]);
  return rows.map((row) => decorate(row, linked));
}

/** One live email flow of the brand, decorated, or null: another brand's id never resolves. */
export async function getEmailFlowById(
  db: Db,
  brandId: string,
  id: string,
): Promise<EmailFlowListRow | null> {
  const scope = withBrand(db, brandId);
  const [row] = await scope.select(emailFlows, eq(emailFlows.id, id)).limit(1);
  if (row === undefined) return null;
  return decorate(row, await linkedWork(db, scope));
}

/** Creates an email flow in the scope; `brand_id` is the scope's, whatever `values` says. */
export async function insertEmailFlow(
  db: Db,
  brandId: string,
  values: EmailFlowInput,
  actorId: string,
): Promise<EmailFlow> {
  const [row] = await withBrand(db, brandId)
    .insert(emailFlows, { ...values, createdBy: actorId, updatedBy: actorId })
    .returning();
  if (row === undefined) {
    throw new Error('email_flows insert returned no row');
  }
  return row;
}

/**
 * Patches one live email flow of the brand and returns it, or null when the id belongs to another
 * brand or to a soft-deleted row — the scope makes those the same outcome: zero rows changed.
 */
export async function updateEmailFlow(
  db: Db,
  brandId: string,
  id: string,
  patch: Partial<EmailFlowInput>,
  actorId: string,
): Promise<EmailFlow | null> {
  const [row] = await withBrand(db, brandId)
    .update(
      emailFlows,
      { ...patch, updatedBy: actorId, updatedAt: new Date() },
      eq(emailFlows.id, id),
    )
    .returning();
  return row ?? null;
}
