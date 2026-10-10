import {
  DEMO_BRAND_ID,
  clientAngles,
  clientCalendarEvents,
  clientConcepts,
  clientCopywriting,
  clientCreatives,
  clientCreators,
  clientPartnershipAds,
  clientThemes,
  demoAngles,
  demoCampaigns,
  demoConcepts,
  demoCopy,
  demoCreators,
  demoThemes,
  type ClientAngle,
  type ClientCalendarEvent,
  type ClientConcept,
  type ClientCopy,
  type ClientCreative,
  type ClientCreator,
  type ClientPartnershipAd,
  type ClientTheme,
  type Db,
} from '@tas/db';
import { serverEnv } from '@tas/env';

import { inDemoMode } from './data-source';
import { requestConnection } from '@/lib/request-db';

interface DbConnection {
  readonly db: Db;
  readonly close: () => Promise<void>;
}

function neonConnection(databaseUrl: string): DbConnection {
  return requestConnection(databaseUrl);
}

async function withDb<T>(query: (db: Db) => Promise<T>): Promise<T> {
  const databaseUrl = serverEnv().DATABASE_URL;
  if (databaseUrl === undefined) {
    throw new Error('DATABASE_URL is not configured.');
  }
  const { db, close } = neonConnection(databaseUrl);
  try {
    return await query(db);
  } finally {
    await close();
  }
}

export async function loadClientThemes(): Promise<ClientTheme[]> {
  if (inDemoMode()) {
    return demoThemes.map((t) => ({
      id: t.id,
      name: t.name,
      category: t.category,
      isActive: t.isActive,
    }));
  }
  return withDb((db) => clientThemes(db));
}

export async function loadClientConcepts(brandId: string): Promise<ClientConcept[]> {
  if (inDemoMode()) {
    return demoConcepts
      .filter((c) => c.brandId === DEMO_BRAND_ID)
      .map((c) => ({
        id: c.id,
        batch: c.batch,
        category: c.category,
        name: c.name,
        conceptStyle: c.conceptStyle ?? null,
        angleName: null,
        themeName: null,
        productName: null,
        description: c.scriptIdea ?? null,
        painPoints: null,
        usp: null,
        personaName: null,
        hookExamples: c.hookExamples ?? null,
        clientApprovalStatus: c.clientApprovalStatus ?? null,
        clientStatus: c.clientStatus,
      }));
  }
  return withDb((db) => clientConcepts(db, brandId));
}

export async function loadClientCreatives(brandId: string): Promise<ClientCreative[]> {
  if (inDemoMode()) {
    return [];
  }
  return withDb((db) => clientCreatives(db, brandId));
}

export async function loadClientCopywriting(brandId: string): Promise<ClientCopy[]> {
  if (inDemoMode()) {
    return demoCopy
      .filter((c) => c.brandId === DEMO_BRAND_ID)
      .map((c) => ({
        id: c.id,
        copyNumber: c.copyNumber,
        primaryCopy: c.primaryCopy ?? null,
        headline: c.headline ?? null,
        linkDescription: c.linkDescription ?? null,
        cta: c.cta,
        funnel: c.funnel ?? null,
        status: c.status,
        clientComment: c.clientComment ?? null,
      }));
  }
  return withDb((db) => clientCopywriting(db, brandId));
}

export async function loadClientCreators(brandId: string): Promise<ClientCreator[]> {
  if (inDemoMode()) {
    return demoCreators
      .filter((c) => c.brandId === DEMO_BRAND_ID)
      .map((c) => ({
        id: c.id,
        name: c.name,
        ageBracket: c.ageBracket ?? null,
        gender: c.gender ?? null,
        profilePicUrl: c.profilePicUrl ?? null,
        videoIntroUrl: c.videoIntroUrl ?? null,
        shippingLocation: c.shippingLocation ?? null,
        trackingNumber: c.trackingNumber ?? null,
        deadline: c.deadline ?? null,
        clientStatus: c.clientStatus,
        clientNote: c.clientNote ?? null,
        rawAssetsUrl: c.rawAssetsUrl ?? null,
      }));
  }
  return withDb((db) => clientCreators(db, brandId));
}

export async function loadClientPartnershipAds(brandId: string): Promise<ClientPartnershipAd[]> {
  if (inDemoMode()) {
    return [];
  }
  return withDb((db) => clientPartnershipAds(db, brandId));
}

export async function loadClientAngles(brandId: string): Promise<ClientAngle[]> {
  if (inDemoMode()) {
    return demoAngles
      .filter((a) => a.brandId === DEMO_BRAND_ID)
      .map((a) => ({
        id: a.id,
        name: a.name,
        description: a.description ?? null,
        winning: a.winning,
        personaNames: [],
        productNames: [],
      }));
  }
  return withDb((db) => clientAngles(db, brandId));
}

export interface ClientProgressData {
  concepts: readonly { clientStatus: string | null }[];
  briefs: readonly { clientStatus: string | null }[];
  creativeSheet: readonly { status: string | null }[];
}

export async function loadClientProgressData(brandId: string): Promise<ClientProgressData> {
  const [concepts, briefs] = await Promise.all([
    loadClientConcepts(brandId),
    loadClientCreatives(brandId),
  ]);
  return {
    concepts: concepts.map((c) => ({ clientStatus: c.clientStatus })),
    briefs: briefs.map((b) => ({ clientStatus: b.clientStatus })),
    creativeSheet: [],
  };
}

export async function loadClientCalendar(brandId: string): Promise<ClientCalendarEvent[]> {
  if (inDemoMode()) {
    return demoCampaigns
      .filter((c) => c.brandId === DEMO_BRAND_ID)
      .map((c) => ({
        id: c.id,
        name: c.name,
        holiday: c.holiday ?? null,
        officialDate: c.officialDate ?? null,
        adsLaunchDate: c.adsLaunchDate ?? null,
        adsEndDate: c.adsEndDate ?? null,
      }));
  }
  return withDb((db) => clientCalendarEvents(db, brandId));
}
