import { assetCategories } from '@tas/db';

import { loadAssets } from '@/lib/assets-source';
import { loadBrandScope } from '@/lib/data-source';
import { isDemoMode } from '@/lib/demo-mode';
import { absoluteTime, relativeTime } from '@/lib/relative-time';
import { viewerRole } from '@/lib/viewer-role';

import { AssetLibrary, type AssetItem } from './asset-grid';

export default async function AssetsPage() {
  const [{ rows }, demo, scope, role] = await Promise.all([
    loadAssets(),
    Promise.resolve(isDemoMode()),
    loadBrandScope(),
    viewerRole(),
  ]);
  const now = new Date();

  const items: AssetItem[] = rows.map((asset) => ({
    asset,
    updatedLabel: relativeTime(asset.createdAt, now),
    updatedTitle: absoluteTime(asset.createdAt),
    sizeLabel: formatBytes(asset.sizeBytes),
  }));

  // Admin and CSM may delete; everyone else sees the Delete control hidden. Demo mode is
  // 'admin', so the control shows but the Server Action refuses with the shipped copy.
  const canDelete = role === 'admin' || role === 'csm';

  return (
    <AssetLibrary
      items={items}
      demo={demo}
      categories={[...assetCategories]}
      brandId={scope.active?.id ?? null}
      canDelete={canDelete}
    />
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${String(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
