import { desc, eq, isNull } from 'drizzle-orm';

import type { Db } from './db';
import {
  campaignsOffers,
  collections,
  emailCampaignCampaigns,
  emailCampaignCollections,
  emailCampaignProducts,
  emailCampaigns,
  products,
  users,
  type EmailCampaign,
  type NewEmailCampaign,
} from './schema';
import { withBrand, type BrandScope } from './tenancy';

/**
 * The Email Campaigns page's data access (Airtable "Email Campaigns Management", `tblABjVpwRpYtY7de`;
 * audit §2.10). A copy of `products.ts`, function for function: every function takes the database
 * first (no singleton), reads and writes go through `withBrand(db, brandId)`, and nothing here is
 * business logic. The two Airtable formulas — Design Due Date and Copywriting Due Date — are
 * computed HERE, never stored and never computed inside a component.
 */

/** The columns the scope, the clock and the actor own; a caller never sets them. */
type ManagedColumn =
  'id' | 'brandId' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy' | 'deletedAt';

/** What the panel submits for create (`name` required) or patches. */
export type EmailCampaignInput = Omit<NewEmailCampaign, ManagedColumn>;

/** The two formula fields of the base, derived from `send_date` and read-only everywhere. */
export interface EmailCampaignDueDates {
  readonly designDueDate: string | null;
  readonly copywritingDueDate: string | null;
}

/**
 * An email campaign as the grid and the panel render it: the row, the two due dates, the assignee's
 * name (a lookup on `users.clerk_user_id`) and the three links read from their junctions, ids and
 * names side by side in the same order. `demoEmailCampaigns` satisfies this type, so the page reads
 * fixtures and database rows through one shape.
 */
export type EmailCampaignListRow = EmailCampaign &
  EmailCampaignDueDates & {
    assigneeName: string | null;
    campaignOfferIds: string[];
    campaignOfferNames: string[];
    productIds: string[];
    productNames: string[];
    collectionIds: string[];
    collectionNames: string[];
  };

/** "Design Due Date" = `DATEADD({Send Date}, -5, 'days')` in the base. */
export const EMAIL_DESIGN_DUE_OFFSET_DAYS = -5;
/** "Copywriting Due Date" = `DATEADD({Design Due Date}, -5, 'days')`, so ten days before the send. */
export const EMAIL_COPYWRITING_DUE_OFFSET_DAYS = -10;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** `YYYY-MM-DD` shifted by whole days in UTC, so no time zone can move it across midnight. */
function shiftIsoDate(date: string, days: number): string {
  const match = ISO_DATE.exec(date);
  if (match === null) return date;
  const [, year, month, day] = match;
  const shifted = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day) + days));
  return shifted.toISOString().slice(0, 10);
}

/** The two formula fields for one send date; a campaign with no send date has no due dates. */
export function emailCampaignDueDates(sendDate: string | null): EmailCampaignDueDates {
  if (sendDate === null) return { designDueDate: null, copywritingDueDate: null };
  return {
    designDueDate: shiftIsoDate(sendDate, EMAIL_DESIGN_DUE_OFFSET_DAYS),
    copywritingDueDate: shiftIsoDate(sendDate, EMAIL_COPYWRITING_DUE_OFFSET_DAYS),
  };
}

// ── Junction bulk loaders (list view: every link of a brand in one read each) ────────────────

export async function loadAllEmailCampaignCampaigns(db: Db): Promise<Map<string, string[]>> {
  const rows = await db.select().from(emailCampaignCampaigns);
  const map = new Map<string, string[]>();
  for (const row of rows) {
    const existing = map.get(row.emailCampaignId);
    if (existing) existing.push(row.campaignOfferId);
    else map.set(row.emailCampaignId, [row.campaignOfferId]);
  }
  return map;
}

export async function loadAllEmailCampaignProducts(db: Db): Promise<Map<string, string[]>> {
  const rows = await db.select().from(emailCampaignProducts);
  const map = new Map<string, string[]>();
  for (const row of rows) {
    const existing = map.get(row.emailCampaignId);
    if (existing) existing.push(row.productId);
    else map.set(row.emailCampaignId, [row.productId]);
  }
  return map;
}

export async function loadAllEmailCampaignCollections(db: Db): Promise<Map<string, string[]>> {
  const rows = await db.select().from(emailCampaignCollections);
  const map = new Map<string, string[]>();
  for (const row of rows) {
    const existing = map.get(row.emailCampaignId);
    if (existing) existing.push(row.collectionId);
    else map.set(row.emailCampaignId, [row.collectionId]);
  }
  return map;
}

// ── Lookups ─────────────────────────────────────────────────────────────────────────────────

interface LinkedWork {
  /** clerkUserId -> full name, for the Assignee lookup. */
  assigneeNames: Map<string, string>;
  /** The brand's live rows of each linked table, id -> name. A deleted or foreign target is absent. */
  campaignNames: Map<string, string>;
  productNames: Map<string, string>;
  collectionNames: Map<string, string>;
  /** emailCampaignId -> linked ids, straight from the junctions. */
  campaignLinks: Map<string, string[]>;
  productLinks: Map<string, string[]>;
  collectionLinks: Map<string, string[]>;
}

/**
 * Everything the list rows are decorated with, loaded once per request. The linked tables are read
 * through the same scope, so a junction row pointing at another brand's product — or at a
 * soft-deleted one — resolves to nothing and is dropped from the row (the junction is left as is).
 * Counting and naming happen in TypeScript because `withBrand` hands back a sealed query surface
 * with no join (TICKET-005 round 3).
 */
async function linkedWork(db: Db, scope: BrandScope): Promise<LinkedWork> {
  const [
    brandCampaigns,
    brandProducts,
    brandCollections,
    liveUsers,
    campaignLinks,
    productLinks,
    collectionLinks,
  ] = await Promise.all([
    scope.select(campaignsOffers),
    scope.select(products),
    scope.select(collections),
    db
      .select({ clerkUserId: users.clerkUserId, fullName: users.fullName })
      .from(users)
      .where(isNull(users.deletedAt)),
    loadAllEmailCampaignCampaigns(db),
    loadAllEmailCampaignProducts(db),
    loadAllEmailCampaignCollections(db),
  ]);
  return {
    assigneeNames: new Map(liveUsers.map((user) => [user.clerkUserId, user.fullName])),
    campaignNames: new Map(brandCampaigns.map((row) => [row.id, row.name])),
    productNames: new Map(brandProducts.map((row) => [row.id, row.name])),
    collectionNames: new Map(brandCollections.map((row) => [row.id, row.name])),
    campaignLinks,
    productLinks,
    collectionLinks,
  };
}

/** The live targets of one link, as `{ ids, names }` aligned and sorted by name. */
function resolveLinks(
  ids: readonly string[] | undefined,
  names: Map<string, string>,
): { ids: string[]; names: string[] } {
  const pairs: { id: string; name: string }[] = [];
  for (const id of ids ?? []) {
    const name = names.get(id);
    if (name !== undefined) pairs.push({ id, name });
  }
  // Alphabetical, because a junction read carries no ORDER BY and heap order is not a contract.
  pairs.sort((a, b) => a.name.localeCompare(b.name));
  return { ids: pairs.map((pair) => pair.id), names: pairs.map((pair) => pair.name) };
}

function decorate(row: EmailCampaign, linked: LinkedWork): EmailCampaignListRow {
  const offers = resolveLinks(linked.campaignLinks.get(row.id), linked.campaignNames);
  const linkedProducts = resolveLinks(linked.productLinks.get(row.id), linked.productNames);
  const linkedCollections = resolveLinks(
    linked.collectionLinks.get(row.id),
    linked.collectionNames,
  );
  return {
    ...row,
    ...emailCampaignDueDates(row.sendDate),
    assigneeName:
      row.assigneeId === null ? null : (linked.assigneeNames.get(row.assigneeId) ?? null),
    campaignOfferIds: offers.ids,
    campaignOfferNames: offers.names,
    productIds: linkedProducts.ids,
    productNames: linkedProducts.names,
    collectionIds: linkedCollections.ids,
    collectionNames: linkedCollections.names,
  };
}

// ── Reads ───────────────────────────────────────────────────────────────────────────────────

/** The brand's live email campaigns, newest edit first, each with its due dates and links. */
export async function listEmailCampaigns(db: Db, brandId: string): Promise<EmailCampaignListRow[]> {
  const scope = withBrand(db, brandId);
  const [rows, linked] = await Promise.all([
    scope.select(emailCampaigns).orderBy(desc(emailCampaigns.updatedAt)),
    linkedWork(db, scope),
  ]);
  return rows.map((row) => decorate(row, linked));
}

/** One live email campaign of the brand, or null: another brand's id never resolves. */
export async function getEmailCampaignById(
  db: Db,
  brandId: string,
  id: string,
): Promise<EmailCampaignListRow | null> {
  const scope = withBrand(db, brandId);
  const [row] = await scope.select(emailCampaigns, eq(emailCampaigns.id, id)).limit(1);
  if (row === undefined) return null;
  return decorate(row, await linkedWork(db, scope));
}

// ── Writes ──────────────────────────────────────────────────────────────────────────────────

/** Creates an email campaign in the scope; `brand_id` is the scope's, whatever `values` says. */
export async function insertEmailCampaign(
  db: Db,
  brandId: string,
  values: EmailCampaignInput,
  actorId: string,
): Promise<EmailCampaign> {
  const [row] = await withBrand(db, brandId)
    .insert(emailCampaigns, { ...values, createdBy: actorId, updatedBy: actorId })
    .returning();
  if (row === undefined) {
    throw new Error('email_campaigns insert returned no row');
  }
  return row;
}

/**
 * Patches one live email campaign of the brand and returns it, or null when the id belongs to
 * another brand or to a soft-deleted row — the scope makes those the same outcome: zero rows changed.
 */
export async function updateEmailCampaign(
  db: Db,
  brandId: string,
  id: string,
  patch: Partial<EmailCampaignInput>,
  actorId: string,
): Promise<EmailCampaign | null> {
  const [row] = await withBrand(db, brandId)
    .update(
      emailCampaigns,
      { ...patch, updatedBy: actorId, updatedAt: new Date() },
      eq(emailCampaigns.id, id),
    )
    .returning();
  return row ?? null;
}

// ── Junction sync (delete-then-insert, as `junction-queries.ts`) ────────────────────────────

/** True when the email campaign is a live row of the scope's brand; a sync never touches another's. */
async function ownedByScope(scope: BrandScope, emailCampaignId: string): Promise<boolean> {
  const [row] = await scope.select(emailCampaigns, eq(emailCampaigns.id, emailCampaignId)).limit(1);
  return row !== undefined;
}

/** De-duplicated, and narrowed to the ids of the brand's own live rows: a foreign id is dropped. */
function keep(ids: readonly string[], live: readonly { id: string }[]): string[] {
  const allowed = new Set(live.map((row) => row.id));
  return [...new Set(ids)].filter((id) => allowed.has(id));
}

/**
 * Replaces the email campaign's "Campaigns & Offers" links. Returns the ids actually stored — the
 * brand's live offers among `campaignOfferIds` — or null when the email campaign is not the brand's.
 */
export async function syncEmailCampaignCampaigns(
  db: Db,
  brandId: string,
  emailCampaignId: string,
  campaignOfferIds: readonly string[],
): Promise<string[] | null> {
  const scope = withBrand(db, brandId);
  if (!(await ownedByScope(scope, emailCampaignId))) return null;
  const kept = keep(campaignOfferIds, await scope.select(campaignsOffers));
  await db
    .delete(emailCampaignCampaigns)
    .where(eq(emailCampaignCampaigns.emailCampaignId, emailCampaignId));
  if (kept.length > 0) {
    await db
      .insert(emailCampaignCampaigns)
      .values(kept.map((campaignOfferId) => ({ emailCampaignId, campaignOfferId })));
  }
  return kept;
}

/** Replaces the "(Internal) Product" links; same contract as `syncEmailCampaignCampaigns`. */
export async function syncEmailCampaignProducts(
  db: Db,
  brandId: string,
  emailCampaignId: string,
  productIds: readonly string[],
): Promise<string[] | null> {
  const scope = withBrand(db, brandId);
  if (!(await ownedByScope(scope, emailCampaignId))) return null;
  const kept = keep(productIds, await scope.select(products));
  await db
    .delete(emailCampaignProducts)
    .where(eq(emailCampaignProducts.emailCampaignId, emailCampaignId));
  if (kept.length > 0) {
    await db
      .insert(emailCampaignProducts)
      .values(kept.map((productId) => ({ emailCampaignId, productId })));
  }
  return kept;
}

/** Replaces the "(Internal) Collections" links; same contract as `syncEmailCampaignCampaigns`. */
export async function syncEmailCampaignCollections(
  db: Db,
  brandId: string,
  emailCampaignId: string,
  collectionIds: readonly string[],
): Promise<string[] | null> {
  const scope = withBrand(db, brandId);
  if (!(await ownedByScope(scope, emailCampaignId))) return null;
  const kept = keep(collectionIds, await scope.select(collections));
  await db
    .delete(emailCampaignCollections)
    .where(eq(emailCampaignCollections.emailCampaignId, emailCampaignId));
  if (kept.length > 0) {
    await db
      .insert(emailCampaignCollections)
      .values(kept.map((collectionId) => ({ emailCampaignId, collectionId })));
  }
  return kept;
}
