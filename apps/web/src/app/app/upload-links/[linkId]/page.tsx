import { notFound } from 'next/navigation';

import { isDemoMode } from '@/lib/demo-mode';
import { loadUploadLinkById } from '@/lib/upload-links-source';

import { UploadLinkDetail } from './upload-link-detail';

/**
 * One upload link's detail view. A real route segment — `/app/upload-links/<id>` — not a side panel,
 * so the Back button restores the list. The server component loads the row and hands plain data to
 * the client form; `@tas/db` never enters the browser bundle.
 */
interface UploadLinkPageProps {
  readonly params: Promise<{ linkId: string }>;
}

export default async function UploadLinkPage({ params }: UploadLinkPageProps) {
  const { linkId } = await params;
  const { link } = await loadUploadLinkById(linkId);
  if (link === null) {
    notFound();
  }
  const demo = isDemoMode();

  return (
    <UploadLinkDetail
      link={{
        id: link.id,
        token: link.token,
        label: link.label,
        recipientName: link.recipientName,
        recipientEmail: link.recipientEmail,
        maxUploads: link.maxUploads,
        expiresAt: link.expiresAt !== null ? link.expiresAt.toISOString().slice(0, 10) : null,
        isActive: link.isActive,
        uploadsUsed: link.uploadsUsed,
        notes: link.notes,
      }}
      demo={demo}
    />
  );
}
