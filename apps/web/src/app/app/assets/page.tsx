import { assetCategories } from '@tas/db';

import { loadAssets } from '@/lib/assets-source';
import { loadClientAssetFolders } from '@/lib/client-assets-source';
import { loadBrandScope } from '@/lib/data-source';
import { isDemoMode } from '@/lib/demo-mode';
import { absoluteTime, relativeTime } from '@/lib/relative-time';
import { viewerRole } from '@/lib/viewer-role';

import { AssetLibrary, type AssetItem, type ClientFolderItem } from './asset-grid';

function hostLabel(value: string | null): string | null {
  if (value === null || value.trim() === '') return null;
  try {
    return new URL(value).host.replace(/^www\./, '');
  } catch {
    return value;
  }
}

interface AssetsPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AssetsPage({ searchParams }: AssetsPageProps) {
  const [{ rows }, clientAssetResult, demo, scope, role, params] = await Promise.all([
    loadAssets(),
    loadClientAssetFolders(),
    Promise.resolve(isDemoMode()),
    loadBrandScope(),
    viewerRole(),
    searchParams,
  ]);
  const now = new Date();

  const items: AssetItem[] = rows.map((asset) => ({
    asset,
    updatedLabel: relativeTime(asset.createdAt, now),
    updatedTitle: absoluteTime(asset.createdAt),
    sizeLabel: formatBytes(asset.sizeBytes),
  }));

  const clientFolders: ClientFolderItem[] = clientAssetResult.rows.map((folder) => ({
    id: folder.id,
    name: folder.name,
    description: folder.description,
    locationUrl: folder.locationUrl,
    locationHost: hostLabel(folder.locationUrl),
    designCount: folder.briefIds.length,
    updatedLabel: relativeTime(folder.updatedAt, now),
    updatedTitle: absoluteTime(folder.updatedAt),
  }));

  // Admin and CSM may delete; everyone else sees the Delete control hidden. Demo mode is
  // 'admin', so the control shows but the Server Action refuses with the shipped copy.
  const canDelete = role === 'admin' || role === 'csm';

  const requestedTab = params.tab;
  const initialTab = typeof requestedTab === 'string' ? requestedTab : 'all';

  return (
    <AssetLibrary
      items={items}
      demo={demo}
      categories={[...assetCategories]}
      brandId={scope.active?.id ?? null}
      canDelete={canDelete}
      clientFolders={clientFolders}
      initialTab={initialTab}
    />
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${String(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
