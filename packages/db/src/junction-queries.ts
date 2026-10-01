import { and, eq } from 'drizzle-orm';

import type { Db } from './db';
import {
  anglePersonas,
  angleProducts,
  campaignConcepts,
  conceptAngles,
  conceptCollections,
  conceptThemes,
  copywritingCampaigns,
  creatorConcepts,
  creatorProducts,
} from './schema';

// ── Campaign links (module parity 2026-10-01) ───────────────────────────────
// `copywriting_campaigns` is Meta Copywriting's "Campaign Code"; `campaign_concepts` is the
// Campaigns & Offers field NAMED "Angles" that links Concepts. Both are owned by the record on the
// left of the name; the far side reads them through the loadAll helpers.

export async function syncCopywritingCampaigns(
  db: Db,
  copyId: string,
  campaignOfferIds: readonly string[],
): Promise<void> {
  await db.delete(copywritingCampaigns).where(eq(copywritingCampaigns.copyId, copyId));
  if (campaignOfferIds.length > 0) {
    await db
      .insert(copywritingCampaigns)
      .values(campaignOfferIds.map((campaignOfferId) => ({ copyId, campaignOfferId })));
  }
}

export async function syncCampaignConcepts(
  db: Db,
  campaignOfferId: string,
  conceptIds: readonly string[],
): Promise<void> {
  await db.delete(campaignConcepts).where(eq(campaignConcepts.campaignOfferId, campaignOfferId));
  if (conceptIds.length > 0) {
    await db
      .insert(campaignConcepts)
      .values(conceptIds.map((conceptId) => ({ campaignOfferId, conceptId })));
  }
}

/** `copyId -> campaignOfferIds`. */
export async function loadAllCopywritingCampaigns(db: Db): Promise<Map<string, string[]>> {
  const rows = await db.select().from(copywritingCampaigns);
  const map = new Map<string, string[]>();
  for (const r of rows) {
    const existing = map.get(r.copyId);
    if (existing) existing.push(r.campaignOfferId);
    else map.set(r.copyId, [r.campaignOfferId]);
  }
  return map;
}

/** `conceptId -> campaignOfferIds` (the junction read concept-first). */
export async function loadAllConceptCampaigns(db: Db): Promise<Map<string, string[]>> {
  const rows = await db.select().from(campaignConcepts);
  const map = new Map<string, string[]>();
  for (const r of rows) {
    const existing = map.get(r.conceptId);
    if (existing) existing.push(r.campaignOfferId);
    else map.set(r.conceptId, [r.campaignOfferId]);
  }
  return map;
}

// ── Creator ↔ Concepts ──────────────────────────────────────────────────────

export async function listCreatorConceptIds(db: Db, creatorId: string): Promise<string[]> {
  const rows = await db
    .select({ conceptId: creatorConcepts.conceptId })
    .from(creatorConcepts)
    .where(eq(creatorConcepts.creatorId, creatorId));
  return rows.map((r) => r.conceptId);
}

export async function syncCreatorConcepts(
  db: Db,
  creatorId: string,
  conceptIds: string[],
): Promise<void> {
  await db.delete(creatorConcepts).where(eq(creatorConcepts.creatorId, creatorId));
  if (conceptIds.length > 0) {
    await db
      .insert(creatorConcepts)
      .values(conceptIds.map((conceptId) => ({ creatorId, conceptId })));
  }
}

export async function removeCreatorConcept(
  db: Db,
  creatorId: string,
  conceptId: string,
): Promise<void> {
  await db
    .delete(creatorConcepts)
    .where(and(eq(creatorConcepts.creatorId, creatorId), eq(creatorConcepts.conceptId, conceptId)));
}

// ── Creator ↔ Products ──────────────────────────────────────────────────────

export async function listCreatorProductIds(db: Db, creatorId: string): Promise<string[]> {
  const rows = await db
    .select({ productId: creatorProducts.productId })
    .from(creatorProducts)
    .where(eq(creatorProducts.creatorId, creatorId));
  return rows.map((r) => r.productId);
}

export async function syncCreatorProducts(
  db: Db,
  creatorId: string,
  productIds: string[],
): Promise<void> {
  await db.delete(creatorProducts).where(eq(creatorProducts.creatorId, creatorId));
  if (productIds.length > 0) {
    await db
      .insert(creatorProducts)
      .values(productIds.map((productId) => ({ creatorId, productId })));
  }
}

export async function removeCreatorProduct(
  db: Db,
  creatorId: string,
  productId: string,
): Promise<void> {
  await db
    .delete(creatorProducts)
    .where(and(eq(creatorProducts.creatorId, creatorId), eq(creatorProducts.productId, productId)));
}

// ── Concept ↔ Angles ────────────────────────────────────────────────────────

export async function listConceptAngleIds(db: Db, conceptId: string): Promise<string[]> {
  const rows = await db
    .select({ angleId: conceptAngles.angleId })
    .from(conceptAngles)
    .where(eq(conceptAngles.conceptId, conceptId));
  return rows.map((r) => r.angleId);
}

export async function syncConceptAngles(
  db: Db,
  conceptId: string,
  angleIds: string[],
): Promise<void> {
  await db.delete(conceptAngles).where(eq(conceptAngles.conceptId, conceptId));
  if (angleIds.length > 0) {
    await db.insert(conceptAngles).values(angleIds.map((angleId) => ({ conceptId, angleId })));
  }
}

// ── Concept ↔ Themes ────────────────────────────────────────────────────────

export async function listConceptThemeIds(db: Db, conceptId: string): Promise<string[]> {
  const rows = await db
    .select({ themeId: conceptThemes.themeId })
    .from(conceptThemes)
    .where(eq(conceptThemes.conceptId, conceptId));
  return rows.map((r) => r.themeId);
}

export async function syncConceptThemes(
  db: Db,
  conceptId: string,
  themeIds: string[],
): Promise<void> {
  await db.delete(conceptThemes).where(eq(conceptThemes.conceptId, conceptId));
  if (themeIds.length > 0) {
    await db.insert(conceptThemes).values(themeIds.map((themeId) => ({ conceptId, themeId })));
  }
}

// ── Concept ↔ Creators (reverse direction: concept → its creators) ──────────

export async function listConceptCreatorIds(db: Db, conceptId: string): Promise<string[]> {
  const rows = await db
    .select({ creatorId: creatorConcepts.creatorId })
    .from(creatorConcepts)
    .where(eq(creatorConcepts.conceptId, conceptId));
  return rows.map((r) => r.creatorId);
}

export async function syncConceptCreators(
  db: Db,
  conceptId: string,
  creatorIds: string[],
): Promise<void> {
  await db.delete(creatorConcepts).where(eq(creatorConcepts.conceptId, conceptId));
  if (creatorIds.length > 0) {
    await db
      .insert(creatorConcepts)
      .values(creatorIds.map((creatorId) => ({ creatorId, conceptId })));
  }
}

// ── Angle ↔ Personas ────────────────────────────────────────────────────────

export async function listAnglePersonaIds(db: Db, angleId: string): Promise<string[]> {
  const rows = await db
    .select({ personaId: anglePersonas.personaId })
    .from(anglePersonas)
    .where(eq(anglePersonas.angleId, angleId));
  return rows.map((r) => r.personaId);
}

export async function syncAnglePersonas(
  db: Db,
  angleId: string,
  personaIds: string[],
): Promise<void> {
  await db.delete(anglePersonas).where(eq(anglePersonas.angleId, angleId));
  if (personaIds.length > 0) {
    await db.insert(anglePersonas).values(personaIds.map((personaId) => ({ angleId, personaId })));
  }
}

// ── Angle ↔ Products ────────────────────────────────────────────────────────

export async function listAngleProductIds(db: Db, angleId: string): Promise<string[]> {
  const rows = await db
    .select({ productId: angleProducts.productId })
    .from(angleProducts)
    .where(eq(angleProducts.angleId, angleId));
  return rows.map((r) => r.productId);
}

export async function syncAngleProducts(
  db: Db,
  angleId: string,
  productIds: string[],
): Promise<void> {
  await db.delete(angleProducts).where(eq(angleProducts.angleId, angleId));
  if (productIds.length > 0) {
    await db.insert(angleProducts).values(productIds.map((productId) => ({ angleId, productId })));
  }
}

// ── Concept ↔ Collections ──────────────────────────────────────────────────

export async function listConceptCollectionIds(db: Db, conceptId: string): Promise<string[]> {
  const rows = await db
    .select({ collectionId: conceptCollections.collectionId })
    .from(conceptCollections)
    .where(eq(conceptCollections.conceptId, conceptId));
  return rows.map((r) => r.collectionId);
}

export async function syncConceptCollections(
  db: Db,
  conceptId: string,
  collectionIds: string[],
): Promise<void> {
  await db.delete(conceptCollections).where(eq(conceptCollections.conceptId, conceptId));
  if (collectionIds.length > 0) {
    await db
      .insert(conceptCollections)
      .values(collectionIds.map((collectionId) => ({ conceptId, collectionId })));
  }
}

// ── Bulk loaders (list view: load all junction rows for a brand at once) ────

export async function loadAllConceptAngles(db: Db): Promise<Map<string, string[]>> {
  const rows = await db.select().from(conceptAngles);
  const map = new Map<string, string[]>();
  for (const r of rows) {
    const existing = map.get(r.conceptId);
    if (existing) existing.push(r.angleId);
    else map.set(r.conceptId, [r.angleId]);
  }
  return map;
}

export async function loadAllCreatorConcepts(db: Db): Promise<Map<string, string[]>> {
  const rows = await db.select().from(creatorConcepts);
  const map = new Map<string, string[]>();
  for (const r of rows) {
    const existing = map.get(r.creatorId);
    if (existing) existing.push(r.conceptId);
    else map.set(r.creatorId, [r.conceptId]);
  }
  return map;
}

export async function loadAllCreatorProducts(db: Db): Promise<Map<string, string[]>> {
  const rows = await db.select().from(creatorProducts);
  const map = new Map<string, string[]>();
  for (const r of rows) {
    const existing = map.get(r.creatorId);
    if (existing) existing.push(r.productId);
    else map.set(r.creatorId, [r.productId]);
  }
  return map;
}

/** The concept side of `creator_concepts` — the same rows as `loadAllCreatorConcepts`, keyed the other way. */
export async function loadAllConceptCreators(db: Db): Promise<Map<string, string[]>> {
  const rows = await db.select().from(creatorConcepts);
  const map = new Map<string, string[]>();
  for (const r of rows) {
    const existing = map.get(r.conceptId);
    if (existing) existing.push(r.creatorId);
    else map.set(r.conceptId, [r.creatorId]);
  }
  return map;
}

export async function loadAllConceptThemes(db: Db): Promise<Map<string, string[]>> {
  const rows = await db.select().from(conceptThemes);
  const map = new Map<string, string[]>();
  for (const r of rows) {
    const existing = map.get(r.conceptId);
    if (existing) existing.push(r.themeId);
    else map.set(r.conceptId, [r.themeId]);
  }
  return map;
}

export async function loadAllAnglePersonas(db: Db): Promise<Map<string, string[]>> {
  const rows = await db.select().from(anglePersonas);
  const map = new Map<string, string[]>();
  for (const r of rows) {
    const existing = map.get(r.angleId);
    if (existing) existing.push(r.personaId);
    else map.set(r.angleId, [r.personaId]);
  }
  return map;
}

export async function loadAllAngleProducts(db: Db): Promise<Map<string, string[]>> {
  const rows = await db.select().from(angleProducts);
  const map = new Map<string, string[]>();
  for (const r of rows) {
    const existing = map.get(r.angleId);
    if (existing) existing.push(r.productId);
    else map.set(r.angleId, [r.productId]);
  }
  return map;
}

export async function loadAllConceptCollections(db: Db): Promise<Map<string, string[]>> {
  const rows = await db.select().from(conceptCollections);
  const map = new Map<string, string[]>();
  for (const r of rows) {
    const existing = map.get(r.conceptId);
    if (existing) existing.push(r.collectionId);
    else map.set(r.conceptId, [r.collectionId]);
  }
  return map;
}
