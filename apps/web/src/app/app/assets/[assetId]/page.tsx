import { notFound } from 'next/navigation';
import { assetCategories } from '@tas/db';

import { loadAssetById } from '@/lib/assets-source';
import { isDemoMode } from '@/lib/demo-mode';

import { AssetDetail, type AssetValues } from './asset-detail';

interface AssetPageProps {
  readonly params: Promise<{ assetId: string }>;
}

export default async function AssetPage({ params }: AssetPageProps) {
  const { assetId } = await params;
  const demo = isDemoMode();
  const creating = assetId === 'new';

  const { asset } = creating ? { asset: null } : await loadAssetById(assetId);
  if (!creating && asset === null) notFound();

  const values: AssetValues | null =
    asset === null
      ? null
      : {
          id: asset.id,
          filename: asset.filename,
          contentType: asset.contentType,
          sizeBytes: asset.sizeBytes,
          r2Key: asset.r2Key,
          url: asset.url,
          category: asset.category,
          conceptId: asset.conceptId,
          caption: asset.caption,
        };

  return <AssetDetail asset={values} demo={demo} categories={[...assetCategories]} />;
}
