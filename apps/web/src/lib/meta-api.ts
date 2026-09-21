'use server';

import { serverEnv } from '@tas/env';

export function isMetaAvailable(): boolean {
  const env = serverEnv();
  return env.META_ACCESS_TOKEN !== undefined && env.META_AD_ACCOUNT_ID !== undefined;
}

export interface MetaInsight {
  readonly adId: string;
  readonly adName: string;
  readonly spend: string;
  readonly impressions: number;
  readonly clicks: number;
  readonly conversions: number;
  readonly ctr: string;
  readonly cpc: string;
  readonly cpa: string;
  readonly dateStart: string;
  readonly dateStop: string;
}

export interface MetaFetchResult {
  readonly ok: true;
  readonly insights: MetaInsight[];
}

export interface MetaFetchFailure {
  readonly ok: false;
  readonly error: string;
}

export type MetaFetchOutcome = MetaFetchResult | MetaFetchFailure;

export async function fetchMetaInsights(dateRange: string): Promise<MetaFetchOutcome> {
  const env = serverEnv();
  if (!isMetaAvailable()) return { ok: false, error: 'Meta credentials are not configured.' };

  const token = env.META_ACCESS_TOKEN ?? '';
  const accountId = env.META_AD_ACCOUNT_ID ?? '';
  const fields = 'ad_id,ad_name,spend,impressions,inline_link_clicks,actions';
  const url =
    `https://graph.facebook.com/v21.0/act_${accountId}/insights` +
    `?fields=${fields}&time_range=${encodeURIComponent(dateRange)}&level=ad&limit=500` +
    `&access_token=${token}`;

  const res = await fetch(url);
  if (!res.ok) return { ok: false, error: `Meta API error: ${String(res.status)}` };
  interface MetaRow {
    ad_id?: string;
    ad_name?: string;
    spend?: string;
    impressions?: string;
    inline_link_clicks?: string;
    actions?: { action_type: string; value: string }[];
    date_start?: string;
    date_stop?: string;
  }
  const json = (await res.json()) as { data?: MetaRow[] };
  if (!json.data) return { ok: true, insights: [] };

  const insights: MetaInsight[] = json.data.map((row) => {
    const impressions = Number(row.impressions ?? 0);
    const clicks = Number(row.inline_link_clicks ?? 0);
    const spend = Number(row.spend ?? 0);
    const actions = row.actions ?? [];
    const conv = Number(actions.find((a) => a.action_type === 'purchase')?.value ?? 0);
    return {
      adId: row.ad_id ?? '',
      adName: row.ad_name ?? '',
      spend: spend.toFixed(2),
      impressions,
      clicks,
      conversions: conv,
      ctr: impressions > 0 ? (clicks / impressions).toFixed(4) : '0.0000',
      cpc: clicks > 0 ? (spend / clicks).toFixed(2) : '0.00',
      cpa: conv > 0 ? (spend / conv).toFixed(2) : '0.00',
      dateStart: row.date_start ?? '',
      dateStop: row.date_stop ?? '',
    };
  });

  return { ok: true, insights };
}
