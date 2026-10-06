'use client';

import { useState } from 'react';
import type { AssetCategory } from '@tas/db';
import { Button } from '@tas/ui';

import { AssetUploadModal, type UploadResponse } from '@/components/assets/upload-modal';

// Inlined rather than imported from `@tas/db` as a value: this is a `'use client'` module, and a
// value import of `assetCategories` pulls `pg` into the client bundle through `@tas/db`'s barrel
// index (D-012: `@tas/db` is in `transpilePackages` but not `optimizePackageImports`). The type
// stays sourced from `@tas/db`, so a drift in the enum fails typecheck here.
const CATEGORIES: readonly AssetCategory[] = [
  'reference',
  'broll',
  'raw_asset',
  'mood_board',
  'showcase_video',
];

/**
 * The Oct 7 Asset Library's upload drag-drop label is the one new primitive this ticket introduces
 * (CLAUDE.md UI governance rule 4: "Render every new primitive or status-bearing component on the
 * `/design-system` page"). The story mounts the real modal with a stubbed uploader so a reader can
 * see the three states — idle, selected, 503 "Storage not configured" — without a server round
 * trip. The idle label, the drag-zone copy and the category list all come from the shipped
 * `assetCategories` enum (Oct 5 vocabulary, five values), so a vocabulary drift fails here too.
 */

const BRAND_ID = '00000000-0000-0000-0000-000000000001';

export function AssetUploadModalStory() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'ok' | '503'>('ok');

  const upload = (): Promise<UploadResponse> =>
    mode === 'ok'
      ? Promise.resolve({ ok: true, status: 200 })
      : Promise.resolve({ ok: false, status: 503, error: 'ignored' });

  return (
    <div className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-text">Asset upload modal</p>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={mode === 'ok' ? 'default' : 'outline'}
            onClick={() => {
              setMode('ok');
            }}
          >
            Happy path
          </Button>
          <Button
            size="sm"
            variant={mode === '503' ? 'default' : 'outline'}
            onClick={() => {
              setMode('503');
            }}
          >
            Storage not configured (503)
          </Button>
        </div>
      </div>
      <p className="text-xs text-text3">
        The drag-and-drop label, filename preview, category select, and 503 copy. The real modal
        posts to <code className="font-mono">/api/assets/upload</code>; here the uploader is stubbed
        to the chosen state.
      </p>
      <div>
        <Button
          size="sm"
          onClick={() => {
            setOpen(true);
          }}
        >
          Open upload modal
        </Button>
      </div>
      <AssetUploadModal
        brandId={BRAND_ID}
        categories={CATEGORIES}
        open={open}
        onOpenChange={setOpen}
        uploadFn={upload}
      />
    </div>
  );
}
