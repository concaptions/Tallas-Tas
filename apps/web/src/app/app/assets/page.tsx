import { assetCategories } from '@tas/db';

import { loadAssets } from '@/lib/assets-source';
import { isDemoMode } from '@/lib/demo-mode';
import { absoluteTime, relativeTime } from '@/lib/relative-time';

import { AssetLibrary, type AssetItem } from './asset-grid';

export default async function AssetsPage() {
  const [{ rows }, demo] = await Promise.all([loadAssets(), Promise.resolve(isDemoMode())]);
  const now = new Date();

  const items: AssetItem[] = rows.map((asset) => ({
    asset,
    updatedLabel: relativeTime(asset.createdAt, now),
    updatedTitle: absoluteTime(asset.createdAt),
    sizeLabel: formatBytes(asset.sizeBytes),
  }));

  return <AssetLibrary items={items} demo={demo} categories={[...assetCategories]} />;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${String(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
