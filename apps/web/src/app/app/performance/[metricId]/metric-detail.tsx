'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { Button, DisabledWrite, Input, Label } from '@tas/ui';

import { performancePath } from '@/lib/routes';

import { createAdMetricAction, updateAdMetricAction, type MetricActionResult } from '../actions';

export interface MetricValues {
  readonly id: string;
  readonly adName: string;
  readonly metaAdId: string | null;
  readonly briefId: string | null;
  readonly conceptId: string | null;
  readonly spend: string;
  readonly impressions: number;
  readonly clicks: number;
  readonly conversions: number;
  readonly ctr: string | null;
  readonly cpc: string | null;
  readonly cpa: string | null;
  readonly roas: string | null;
  readonly dateRange: string;
}

interface MetricDetailProps {
  readonly metric: MetricValues | null;
  readonly demo: boolean;
}

export function MetricDetail({ metric, demo }: MetricDetailProps) {
  const creating = metric === null;
  const action = creating ? createAdMetricAction : updateAdMetricAction;
  const [state, formAction, pending] = useActionState<MetricActionResult | null, FormData>(
    action,
    null,
  );

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Link href={performancePath} className="text-text3 hover:text-text text-sm">
          &larr; Performance
        </Link>
        <h1 className="text-text text-xl font-semibold">
          {creating ? 'New Ad Metric' : metric.adName}
        </h1>
      </div>

      {state !== null && !state.ok && state.error !== '' && (
        <p className="text-destructive text-sm">{state.error}</p>
      )}

      <form action={formAction} className="space-y-4">
        {!creating && <input type="hidden" name="id" value={metric.id} />}

        <div className="space-y-1.5">
          <Label htmlFor="adName">Ad Name</Label>
          <Input id="adName" name="adName" defaultValue={metric?.adName ?? ''} required />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="metaAdId">Meta Ad ID</Label>
          <Input id="metaAdId" name="metaAdId" defaultValue={metric?.metaAdId ?? ''} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="dateRange">Date Range</Label>
          <Input id="dateRange" name="dateRange" defaultValue={metric?.dateRange ?? ''} required />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="spend">Spend</Label>
            <Input id="spend" name="spend" defaultValue={metric?.spend ?? ''} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="impressions">Impressions</Label>
            <Input
              id="impressions"
              name="impressions"
              type="number"
              defaultValue={metric?.impressions ?? 0}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="clicks">Clicks</Label>
            <Input
              id="clicks"
              name="clicks"
              type="number"
              defaultValue={metric?.clicks ?? 0}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="conversions">Conversions</Label>
            <Input
              id="conversions"
              name="conversions"
              type="number"
              defaultValue={metric?.conversions ?? 0}
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="ctr">CTR</Label>
            <Input id="ctr" name="ctr" defaultValue={metric?.ctr ?? ''} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cpc">CPC</Label>
            <Input id="cpc" name="cpc" defaultValue={metric?.cpc ?? ''} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cpa">CPA</Label>
            <Input id="cpa" name="cpa" defaultValue={metric?.cpa ?? ''} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="roas">ROAS</Label>
            <Input id="roas" name="roas" defaultValue={metric?.roas ?? ''} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="briefId">Brief ID</Label>
          <Input id="briefId" name="briefId" defaultValue={metric?.briefId ?? ''} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="conceptId">Concept ID</Label>
          <Input id="conceptId" name="conceptId" defaultValue={metric?.conceptId ?? ''} />
        </div>

        <DisabledWrite active={demo}>
          <Button type="submit" disabled={demo || pending}>
            {pending ? 'Saving…' : 'Save'}
          </Button>
        </DisabledWrite>
      </form>
    </div>
  );
}
