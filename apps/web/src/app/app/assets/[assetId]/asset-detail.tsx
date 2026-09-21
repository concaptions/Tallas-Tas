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

import { assetsPath } from '@/lib/routes';

import { createAssetAction, updateAssetAction, type AssetActionResult } from '../actions';

export interface AssetValues {
  readonly id: string;
  readonly filename: string;
  readonly contentType: string;
  readonly sizeBytes: number;
  readonly r2Key: string;
  readonly url: string;
  readonly category: string;
  readonly conceptId: string | null;
  readonly caption: string | null;
}

interface AssetDetailProps {
  readonly asset: AssetValues | null;
  readonly demo: boolean;
  readonly categories: readonly string[];
}

export function AssetDetail({ asset, demo, categories }: AssetDetailProps) {
  const creating = asset === null;
  const action = creating ? createAssetAction : updateAssetAction;
  const [state, formAction, pending] = useActionState<AssetActionResult | null, FormData>(
    action,
    null,
  );

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Link href={assetsPath} className="text-text3 hover:text-text text-sm">
          &larr; Assets
        </Link>
        <h1 className="text-text text-xl font-semibold">
          {creating ? 'New Asset' : asset.filename}
        </h1>
      </div>

      {state !== null && !state.ok && state.error !== '' && (
        <p className="text-destructive text-sm">{state.error}</p>
      )}

      <form action={formAction} className="space-y-4">
        {!creating && <input type="hidden" name="id" value={asset.id} />}

        <div className="space-y-1.5">
          <Label htmlFor="filename">Filename</Label>
          <Input id="filename" name="filename" defaultValue={asset?.filename ?? ''} required />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="contentType">Content Type</Label>
          <Input
            id="contentType"
            name="contentType"
            defaultValue={asset?.contentType ?? ''}
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="sizeBytes">Size (bytes)</Label>
          <Input
            id="sizeBytes"
            name="sizeBytes"
            type="number"
            defaultValue={asset?.sizeBytes ?? 0}
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="r2Key">R2 Key</Label>
          <Input id="r2Key" name="r2Key" defaultValue={asset?.r2Key ?? ''} required />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="url">URL</Label>
          <Input id="url" name="url" defaultValue={asset?.url ?? ''} required />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="category">Category</Label>
          <Select name="category" defaultValue={asset?.category ?? 'reference'}>
            <SelectTrigger id="category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat.replace('_', ' ')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="conceptId">Concept ID</Label>
          <Input id="conceptId" name="conceptId" defaultValue={asset?.conceptId ?? ''} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="caption">Caption</Label>
          <Textarea id="caption" name="caption" defaultValue={asset?.caption ?? ''} rows={3} />
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
