import { isDemoMode } from '@/lib/demo-mode';
import { loadUploadLinks } from '@/lib/upload-links-source';

import { UploadLinksTable, type UploadLinkItem } from './upload-links-table';

export default async function UploadLinksPage() {
  const { rows } = await loadUploadLinks();
  const demo = isDemoMode();
  const items: UploadLinkItem[] = rows.map((link) => ({
    link,
    expiresLabel: link.expiresAt !== null ? new Date(link.expiresAt).toLocaleDateString() : 'Never',
    usageLabel:
      link.maxUploads !== null ? `${link.uploadsUsed}/${link.maxUploads}` : link.uploadsUsed,
  }));
  return <UploadLinksTable items={items} demo={demo} />;
}
