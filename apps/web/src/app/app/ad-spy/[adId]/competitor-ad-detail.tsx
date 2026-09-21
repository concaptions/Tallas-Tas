'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import {
  Button,
  DisabledWrite,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@tas/ui';

import { adSpyPath } from '@/lib/routes';

import {
  createCompetitorAdAction,
  updateCompetitorAdAction,
  type AdSpyActionResult,
} from '../actions';

export interface CompetitorAdValues {
  readonly id: string;
  readonly platform: string;
  readonly advertiserName: string;
  readonly adUrl: string;
  readonly headline: string | null;
  readonly bodyText: string | null;
  readonly format: string;
  readonly estimatedSpend: string | null;
  readonly daysActive: number | null;
  readonly firstSeen: string;
  readonly lastSeen: string | null;
  readonly notes: string | null;
}

interface CompetitorAdDetailProps {
  readonly ad: CompetitorAdValues | null;
  readonly demo: boolean;
  readonly platforms: readonly string[];
}

export function CompetitorAdDetail({ ad, demo, platforms }: CompetitorAdDetailProps) {
  const creating = ad === null;
  const action = creating ? createCompetitorAdAction : updateCompetitorAdAction;
  const [state, formAction, pending] = useActionState<AdSpyActionResult | null, FormData>(
    action,
    null,
  );

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Link href={adSpyPath} className="text-text3 hover:text-text text-sm">
          &larr; Ad Spy
        </Link>
        <h1 className="text-text text-xl font-semibold">
          {creating ? 'New Competitor Ad' : ad.advertiserName}
        </h1>
      </div>

      {state !== null && !state.ok && state.error !== '' && (
        <p className="text-destructive text-sm">{state.error}</p>
      )}

      <form action={formAction} className="space-y-4">
        {!creating && <input type="hidden" name="id" value={ad.id} />}

        <div className="space-y-1.5">
          <Label htmlFor="platform">Platform</Label>
          <Select name="platform" defaultValue={ad?.platform ?? 'meta'}>
            <SelectTrigger id="platform">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {platforms.map((p) => (
                <SelectItem key={p} value={p}>
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="advertiserName">Advertiser Name</Label>
          <Input
            id="advertiserName"
            name="advertiserName"
            defaultValue={ad?.advertiserName ?? ''}
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="adUrl">Ad URL</Label>
          <Input id="adUrl" name="adUrl" defaultValue={ad?.adUrl ?? ''} required />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="headline">Headline</Label>
          <Input id="headline" name="headline" defaultValue={ad?.headline ?? ''} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="bodyText">Body Text</Label>
          <Textarea id="bodyText" name="bodyText" defaultValue={ad?.bodyText ?? ''} rows={3} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="format">Format</Label>
          <Input id="format" name="format" defaultValue={ad?.format ?? ''} required />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="estimatedSpend">Estimated Spend</Label>
            <Input
              id="estimatedSpend"
              name="estimatedSpend"
              defaultValue={ad?.estimatedSpend ?? ''}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="daysActive">Days Active</Label>
            <Input
              id="daysActive"
              name="daysActive"
              type="number"
              defaultValue={ad?.daysActive ?? ''}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="firstSeen">First Seen</Label>
            <Input id="firstSeen" name="firstSeen" defaultValue={ad?.firstSeen ?? ''} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lastSeen">Last Seen</Label>
            <Input id="lastSeen" name="lastSeen" defaultValue={ad?.lastSeen ?? ''} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="notes">Notes</Label>
          <Textarea id="notes" name="notes" defaultValue={ad?.notes ?? ''} rows={3} />
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
