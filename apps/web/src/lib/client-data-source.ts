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
  createAutoDb,
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

import { isDemoMode } from './demo-mode';

interface DbConnection {
  readonly db: Db;
  readonly close: () => Promise<void>;
}

function neonConnection(databaseUrl: string): DbConnection {
  const db = createAutoDb(databaseUrl);
  return { db, close: () => db.$client.end() };
}

function inFixtureMode(): boolean {
  if (isDemoMode()) return true;
  return serverEnv().DATABASE_URL === undefined;
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
  if (inFixtureMode()) {
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
  if (inFixtureMode()) {
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
        approvalStatus: c.approvalStatus ?? null,
        clientStatus: c.clientStatus,
      }));
  }
  return withDb((db) => clientConcepts(db, brandId));
}

export async function loadClientCreatives(brandId: string): Promise<ClientCreative[]> {
  if (inFixtureMode()) {
    return [];
  }
  return withDb((db) => clientCreatives(db, brandId));
}

export async function loadClientCopywriting(brandId: string): Promise<ClientCopy[]> {
  if (inFixtureMode()) {
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
  if (inFixtureMode()) {
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
  if (inFixtureMode()) {
    return [];
  }
  return withDb((db) => clientPartnershipAds(db, brandId));
}

export async function loadClientAngles(brandId: string): Promise<ClientAngle[]> {
  if (inFixtureMode()) {
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

export async function loadClientCalendar(brandId: string): Promise<ClientCalendarEvent[]> {
  if (inFixtureMode()) {
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
