/**
 * Client-facing approval status shared across creative sheet items and copywriting
 * (`creative_sheet_items.client_approval_status`, `copywriting.client_approval_status`).
 * The four states a client can move a row through on the approval track.
 *
 * The canonical vocabulary lives in `@tas/db/schema` (`clientApprovalStatuses`); this module
 * re-exports the same four entries with their TONE — `ok`, `error`, `warning` — so a component
 * can color a chip without branching on a key, the same arrangement `creative-status.ts` uses
 * for the internal and client tracks.
 */

export const CLIENT_APPROVAL_STATUS = [
  { key: 'pending_client_approval', label: 'Pending Client Approval', tone: 'warning' },
  { key: 'approved', label: 'Approved', tone: 'ok' },
  { key: 'disapproved', label: 'Disapproved', tone: 'error' },
  { key: 'revision_needed', label: 'Revision Needed', tone: 'warning' },
] as const;

export type ClientApprovalStatusKey = (typeof CLIENT_APPROVAL_STATUS)[number]['key'];

export function clientApprovalLabel(key: string | null | undefined): string {
  const entry = CLIENT_APPROVAL_STATUS.find((s) => s.key === key);
  return entry?.label ?? '—';
}

export function clientApprovalTone(key: string | null | undefined): string {
  const entry = CLIENT_APPROVAL_STATUS.find((s) => s.key === key);
  return entry?.tone ?? 'neutral';
}
