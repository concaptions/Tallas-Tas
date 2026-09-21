'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { Button, DisabledWrite, Input, Label } from '@tas/ui';

import { creatorRankingPath } from '@/lib/routes';

import {
  createCreatorRankingAction,
  updateCreatorRankingAction,
  type RankingActionResult,
} from '../actions';

export interface RankingValues {
  readonly id: string;
  readonly creatorId: string;
  readonly creatorName: string;
  readonly totalAds: number;
  readonly totalSpend: string;
  readonly totalConversions: number;
  readonly avgRoas: string | null;
  readonly avgCpa: string | null;
  readonly rank: number;
  readonly periodLabel: string;
}

interface RankingDetailProps {
  readonly ranking: RankingValues | null;
  readonly demo: boolean;
}

export function RankingDetail({ ranking, demo }: RankingDetailProps) {
  const creating = ranking === null;
  const action = creating ? createCreatorRankingAction : updateCreatorRankingAction;
  const [state, formAction, pending] = useActionState<RankingActionResult | null, FormData>(
    action,
    null,
  );

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Link href={creatorRankingPath} className="text-text3 hover:text-text text-sm">
          &larr; Creator Rankings
        </Link>
        <h1 className="text-text text-xl font-semibold">
          {creating ? 'New Ranking' : ranking.creatorName}
        </h1>
      </div>

      {state !== null && !state.ok && state.error !== '' && (
        <p className="text-destructive text-sm">{state.error}</p>
      )}

      <form action={formAction} className="space-y-4">
        {!creating && <input type="hidden" name="id" value={ranking.id} />}

        <div className="space-y-1.5">
          <Label htmlFor="creatorId">Creator ID</Label>
          <Input id="creatorId" name="creatorId" defaultValue={ranking?.creatorId ?? ''} required />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="creatorName">Creator Name</Label>
          <Input
            id="creatorName"
            name="creatorName"
            defaultValue={ranking?.creatorName ?? ''}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="rank">Rank</Label>
            <Input id="rank" name="rank" type="number" defaultValue={ranking?.rank ?? 1} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="periodLabel">Period</Label>
            <Input
              id="periodLabel"
              name="periodLabel"
              defaultValue={ranking?.periodLabel ?? ''}
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="totalAds">Total Ads</Label>
            <Input
              id="totalAds"
              name="totalAds"
              type="number"
              defaultValue={ranking?.totalAds ?? 0}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="totalSpend">Total Spend</Label>
            <Input
              id="totalSpend"
              name="totalSpend"
              defaultValue={ranking?.totalSpend ?? ''}
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="totalConversions">Total Conversions</Label>
            <Input
              id="totalConversions"
              name="totalConversions"
              type="number"
              defaultValue={ranking?.totalConversions ?? 0}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="avgRoas">Avg ROAS</Label>
            <Input id="avgRoas" name="avgRoas" defaultValue={ranking?.avgRoas ?? ''} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="avgCpa">Avg CPA</Label>
          <Input id="avgCpa" name="avgCpa" defaultValue={ranking?.avgCpa ?? ''} />
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
