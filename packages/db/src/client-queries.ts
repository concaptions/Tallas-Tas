import { and, asc, eq, isNull, sql } from 'drizzle-orm';

import type { Db } from './db';
import {
  loadAllAnglePersonas,
  loadAllAngleProducts,
  loadAllConceptAngles,
  loadAllConceptThemes,
} from './junction-queries';
import {
  angles,
  annotations,
  campaignsOffers,
  comments,
  concepts,
  copywriting,
  creativeBriefs,
  creators,
  interfaceFields,
  interfacePages,
  personas,
  products,
  themes,
  type InterfacePageKey,
} from './schema';

/**
 * Client-scoped query layer (PRD §10, TICKET-038b). Every function in this module returns ONLY the
 * fields the client is allowed to see — the allowlist from `docs/design/sprint-06-client-field-allowlist.md`.
 * These are explicit `SELECT` with named columns, NOT `SELECT *` with post-hoc stripping. A bug in
 * this file is a data leak to a paying client; treat it accordingly.
 *
 * Every query enforces `brand_id = $brandId AND deleted_at IS NULL`.
 */

function brandScope(brandId: string) {
  return {
    concepts: and(eq(concepts.brandId, brandId), isNull(concepts.deletedAt)),
    briefs: and(eq(creativeBriefs.brandId, brandId), isNull(creativeBriefs.deletedAt)),
    copywriting: and(eq(copywriting.brandId, brandId), isNull(copywriting.deletedAt)),
    creators: and(eq(creators.brandId, brandId), isNull(creators.deletedAt)),
    campaigns: and(eq(campaignsOffers.brandId, brandId), isNull(campaignsOffers.deletedAt)),
    annotations: and(eq(annotations.brandId, brandId), isNull(annotations.deletedAt)),
    comments: and(eq(comments.brandId, brandId), isNull(comments.deletedAt)),
  };
}

// ─── Page 1: Concepts ───────────────────────────────────────────────────────

export interface ClientConcept {
  id: string;
  batch: string | null;
  category: string | null;
  name: string;
  conceptStyle: string | null;
  angleName: string | null;
  themeName: string | null;
  productName: string | null;
  description: string | null;
  painPoints: string | null;
  usp: string | null;
  personaName: string | null;
  hookExamples: string | null;
  approvalStatus: string | null;
  clientStatus: string;
}

export async function clientConcepts(db: Db, brandId: string): Promise<ClientConcept[]> {
  const scope = brandScope(brandId);
  const [conceptRows, angleRows, personaRows, productRows, themeRows, caMap, ctMap, apMap, aprMap] =
    await Promise.all([
      db
        .select({
          id: concepts.id,
          batch: concepts.batch,
          category: concepts.category,
          name: concepts.name,
          conceptStyle: concepts.conceptStyle,
          description: concepts.scriptIdea,
          hookExamples: concepts.hookExamples,
          approvalStatus: concepts.approvalStatus,
          clientStatus: concepts.clientStatus,
        })
        .from(concepts)
        .where(scope.concepts)
        .orderBy(asc(concepts.createdAt)),
      db
        .select({
          id: angles.id,
          name: angles.name,
          painPoints: angles.painPoints,
          usp: angles.usp,
        })
        .from(angles)
        .where(and(eq(angles.brandId, brandId), isNull(angles.deletedAt))),
      db
        .select({ id: personas.id, name: personas.name })
        .from(personas)
        .where(and(eq(personas.brandId, brandId), isNull(personas.deletedAt))),
      db
        .select({ id: products.id, name: products.name })
        .from(products)
        .where(and(eq(products.brandId, brandId), isNull(products.deletedAt))),
      db.select({ id: themes.id, name: themes.name }).from(themes).where(isNull(themes.deletedAt)),
      loadAllConceptAngles(db),
      loadAllConceptThemes(db),
      loadAllAnglePersonas(db),
      loadAllAngleProducts(db),
    ]);

  const angleMap = new Map(angleRows.map((a) => [a.id, a]));
  const personaMap = new Map(personaRows.map((p) => [p.id, p.name]));
  const productMap = new Map(productRows.map((p) => [p.id, p.name]));
  const themeMap = new Map(themeRows.map((t) => [t.id, t.name]));

  return conceptRows.map((c) => {
    const firstAngleId = (caMap.get(c.id) ?? [])[0] ?? null;
    const angle = firstAngleId ? angleMap.get(firstAngleId) : undefined;
    const firstThemeId = (ctMap.get(c.id) ?? [])[0] ?? null;
    const firstPersonaId = firstAngleId ? ((apMap.get(firstAngleId) ?? [])[0] ?? null) : null;
    const firstProductId = firstAngleId ? ((aprMap.get(firstAngleId) ?? [])[0] ?? null) : null;
    return {
      ...c,
      angleName: angle?.name ?? null,
      themeName: firstThemeId ? (themeMap.get(firstThemeId) ?? null) : null,
      productName: firstProductId ? (productMap.get(firstProductId) ?? null) : null,
      description: c.description,
      painPoints: angle?.painPoints ?? null,
      usp: angle?.usp ?? null,
      personaName: firstPersonaId ? (personaMap.get(firstPersonaId) ?? null) : null,
    };
  });
}

// ─── Page 2: Creatives ──────────────────────────────────────────────────────

export interface ClientCreative {
  id: string;
  name: string;
  type: string;
  funnel: string;
  designFile: string[] | null;
  inspirationImage: string[] | null;
  clientStatus: string;
  platform: string | null;
  performance: string | null;
}

export async function clientCreatives(db: Db, brandId: string): Promise<ClientCreative[]> {
  const rows = await db
    .select({
      id: creativeBriefs.id,
      name: creativeBriefs.name,
      type: creativeBriefs.type,
      funnel: creativeBriefs.funnel,
      designFile: creativeBriefs.designFile,
      inspirationImage: creativeBriefs.inspirationImage,
      clientStatus: creativeBriefs.clientStatus,
      platform: creativeBriefs.platform,
      performance: creativeBriefs.performance,
    })
    .from(creativeBriefs)
    .where(and(brandScope(brandId).briefs, eq(creativeBriefs.internalStatus, 'approved')))
    .orderBy(asc(creativeBriefs.createdAt));
  return rows;
}

// ─── Page 3: Copywriting ────────────────────────────────────────────────────

export interface ClientCopy {
  id: string;
  copyNumber: number;
  primaryCopy: string | null;
  headline: string | null;
  linkDescription: string | null;
  cta: string;
  funnel: string | null;
  status: string;
  clientComment: string | null;
}

export async function clientCopywriting(db: Db, brandId: string): Promise<ClientCopy[]> {
  const rows = await db
    .select({
      id: copywriting.id,
      copyNumber: copywriting.copyNumber,
      primaryCopy: copywriting.primaryCopy,
      headline: copywriting.headline,
      linkDescription: copywriting.linkDescription,
      cta: copywriting.cta,
      funnel: copywriting.funnel,
      status: copywriting.status,
      clientComment: copywriting.clientComment,
    })
    .from(copywriting)
    .where(brandScope(brandId).copywriting)
    .orderBy(asc(copywriting.createdAt));
  return rows;
}

// ─── Page 4: UGC Management ─────────────────────────────────────────────────

export interface ClientCreator {
  id: string;
  name: string;
  ageBracket: string | null;
  gender: string | null;
  profilePicUrl: string | null;
  videoIntroUrl: string | null;
  shippingLocation: string | null;
  trackingNumber: string | null;
  deadline: Date | null;
  clientStatus: string;
  clientNote: string | null;
  rawAssetsUrl: string | null;
}

export async function clientCreators(db: Db, brandId: string): Promise<ClientCreator[]> {
  const rows = await db
    .select({
      id: creators.id,
      name: creators.name,
      ageBracket: creators.ageBracket,
      gender: creators.gender,
      profilePicUrl: creators.profilePicUrl,
      videoIntroUrl: creators.videoIntroUrl,
      shippingLocation: creators.shippingLocation,
      trackingNumber: creators.trackingNumber,
      deadline: creators.deadline,
      clientStatus: creators.clientStatus,
      clientNote: creators.clientNote,
      rawAssetsUrl: creators.rawAssetsUrl,
    })
    .from(creators)
    .where(brandScope(brandId).creators)
    .orderBy(asc(creators.createdAt));
  return rows;
}

// ─── Page 5: Partnership Ads Tracking ───────────────────────────────────────

export interface ClientPartnershipAd {
  id: string;
  name: string;
  instagramUsername: string | null;
  partnershipActivity: string;
  expiresOn: string | null;
}

export async function clientPartnershipAds(
  db: Db,
  brandId: string,
): Promise<ClientPartnershipAd[]> {
  const rows = await db
    .select({
      id: creators.id,
      name: creators.name,
      instagramUsername: creators.instagramUsername,
      partnershipActivity: creators.partnershipActivity,
      expiresOn: sql<string | null>`
        CASE WHEN ${creators.partnershipActivatedAt} IS NOT NULL
              AND ${creators.partnershipPeriodDays} IS NOT NULL
        THEN (${creators.partnershipActivatedAt}::date + ${creators.partnershipPeriodDays} * INTERVAL '1 day')::text
        ELSE NULL END
      `.as('expires_on'),
    })
    .from(creators)
    .where(and(brandScope(brandId).creators, eq(creators.forPartnershipAds, true)))
    .orderBy(asc(creators.createdAt));
  return rows;
}

// ─── Page 6: Promotional Calendar ───────────────────────────────────────────

export interface ClientCalendarEvent {
  id: string;
  name: string;
  holiday: string | null;
  officialDate: string | null;
  adsLaunchDate: string | null;
  adsEndDate: string | null;
}

export async function clientCalendarEvents(
  db: Db,
  brandId: string,
): Promise<ClientCalendarEvent[]> {
  const rows = await db
    .select({
      id: campaignsOffers.id,
      name: campaignsOffers.name,
      holiday: campaignsOffers.holiday,
      officialDate: campaignsOffers.officialDate,
      adsLaunchDate: campaignsOffers.adsLaunchDate,
      adsEndDate: campaignsOffers.adsEndDate,
    })
    .from(campaignsOffers)
    .where(brandScope(brandId).campaigns)
    .orderBy(asc(campaignsOffers.officialDate));
  return rows;
}

// ─── Annotations & Comments ─────────────────────────────────────────────────

export interface ClientAnnotation {
  id: string;
  recordType: string;
  recordId: string;
  authorId: string;
  authorName: string;
  kind: 'video_timestamp' | 'image_xy';
  timestampSeconds: number | null;
  x: number | null;
  y: number | null;
  body: string;
  createdAt: Date;
}

export async function listAnnotations(
  db: Db,
  brandId: string,
  recordType: string,
  recordId: string,
): Promise<ClientAnnotation[]> {
  const rows = await db
    .select({
      id: annotations.id,
      recordType: annotations.recordType,
      recordId: annotations.recordId,
      authorId: annotations.authorId,
      authorName: annotations.authorName,
      kind: annotations.kind,
      timestampSeconds: annotations.timestampSeconds,
      x: annotations.x,
      y: annotations.y,
      body: annotations.body,
      createdAt: annotations.createdAt,
    })
    .from(annotations)
    .where(
      and(
        brandScope(brandId).annotations,
        eq(annotations.recordType, recordType),
        eq(annotations.recordId, recordId),
      ),
    )
    .orderBy(asc(annotations.createdAt));
  return rows;
}

export interface ClientComment {
  id: string;
  recordType: string;
  recordId: string;
  parentCommentId: string | null;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: Date;
}

export async function listComments(
  db: Db,
  brandId: string,
  recordType: string,
  recordId: string,
): Promise<ClientComment[]> {
  const rows = await db
    .select({
      id: comments.id,
      recordType: comments.recordType,
      recordId: comments.recordId,
      parentCommentId: comments.parentCommentId,
      authorId: comments.authorId,
      authorName: comments.authorName,
      body: comments.body,
      createdAt: comments.createdAt,
    })
    .from(comments)
    .where(
      and(
        brandScope(brandId).comments,
        eq(comments.recordType, recordType),
        eq(comments.recordId, recordId),
      ),
    )
    .orderBy(asc(comments.createdAt));
  return rows;
}

// ─── Interface Config Filtering ─────────────────────────────────────────────

export interface VisibleField {
  fieldName: string;
  label: string;
  clientEditable: boolean;
}

export async function clientVisibleFields(
  db: Db,
  brandId: string,
  pageKey: InterfacePageKey,
): Promise<VisibleField[]> {
  const rows = await db
    .select({
      fieldName: interfaceFields.fieldName,
      label: interfaceFields.label,
      clientEditable: interfaceFields.clientEditable,
    })
    .from(interfaceFields)
    .innerJoin(interfacePages, eq(interfaceFields.pageId, interfacePages.id))
    .where(
      and(
        eq(interfacePages.brandId, brandId),
        isNull(interfacePages.deletedAt),
        eq(interfacePages.pageKey, pageKey),
        eq(interfacePages.enabled, true),
        eq(interfaceFields.visible, true),
        isNull(interfaceFields.deletedAt),
      ),
    )
    .orderBy(asc(interfaceFields.position));
  return rows;
}
