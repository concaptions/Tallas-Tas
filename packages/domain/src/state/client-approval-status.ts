import type { ChipTone } from './creative-status';

export const CLIENT_APPROVAL_STATUS = [
  { key: 'pending_client_approval', label: 'Pending Client Approval', tone: 'warn' as ChipTone },
  { key: 'approved', label: 'Approved', tone: 'ok' as ChipTone },
  { key: 'disapproved', label: 'Disapproved', tone: 'bad' as ChipTone },
  { key: 'revision_needed', label: 'Revision Needed', tone: 'warn' as ChipTone },
] as const;

export type ClientApprovalStatusKey = (typeof CLIENT_APPROVAL_STATUS)[number]['key'];

export function clientApprovalLabel(key: string | null | undefined): string {
  const entry = CLIENT_APPROVAL_STATUS.find((s) => s.key === key);
  return entry?.label ?? '—';
}

export function clientApprovalTone(key: string | null | undefined): ChipTone {
  const entry = CLIENT_APPROVAL_STATUS.find((s) => s.key === key);
  return entry?.tone ?? 'mute';
}
