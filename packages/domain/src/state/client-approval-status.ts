/**
 * Client-facing approval status on `concepts.client_approval_status` and
 * `copywriting.client_approval_status`: the client's direct response to a delivered concept or copy.
 *
 * ONE client vocabulary (Talal, 2026-10-10). The entries ARE `CLIENT_STATUS` — the six keys of the
 * client track `creative_briefs.client_status` carries since the single-source cutover — with the
 * tone `chipTone` gives each label, so a concept, a copy row and a creative read the same word in
 * the same colour. The earlier four-value spelling of this column (`pending_client_approval`,
 * `revision_needed`) was never written to a row in production; `normalizeClientApprovalStatus`
 * still reads it, so a caller that learnt the old keys stores the new ones. The canonical list in
 * `@tas/db/schema` (`clientApprovalStatuses`) is held equal to this one by the test beside it.
 */

import { CLIENT_STATUS, chipTone, type ChipTone, type ClientStatusKey } from './creative-status';

export type ClientApprovalStatusKey = ClientStatusKey;

export interface ClientApprovalStatusEntry {
  readonly key: ClientApprovalStatusKey;
  readonly label: string;
  readonly tone: ChipTone;
}

export const CLIENT_APPROVAL_STATUS: readonly ClientApprovalStatusEntry[] = CLIENT_STATUS.map(
  (entry) => ({ key: entry.key, label: entry.label, tone: chipTone(entry.label) }),
);

/** The four-value spelling this column had before 2026-10-10, read but never stored again. */
const LEGACY_CLIENT_APPROVAL_KEYS: Readonly<Record<string, ClientApprovalStatusKey>> = {
  pending_client_approval: 'pending_for_approval',
  revision_needed: 'revisions_needed',
};

/**
 * The `CLIENT_STATUS` key a submitted or stored value names: itself when it is one, its new
 * spelling when it is a legacy key, and `null` for anything else (including null and undefined).
 */
export function normalizeClientApprovalStatus(
  key: string | null | undefined,
): ClientApprovalStatusKey | null {
  if (key === null || key === undefined) return null;
  if (CLIENT_APPROVAL_STATUS.some((entry) => entry.key === key)) {
    return key as ClientApprovalStatusKey;
  }
  return LEGACY_CLIENT_APPROVAL_KEYS[key] ?? null;
}

export function clientApprovalLabel(key: string | null | undefined): string {
  const normalised = normalizeClientApprovalStatus(key);
  return CLIENT_APPROVAL_STATUS.find((entry) => entry.key === normalised)?.label ?? '—';
}

export function clientApprovalTone(key: string | null | undefined): ChipTone {
  const normalised = normalizeClientApprovalStatus(key);
  return CLIENT_APPROVAL_STATUS.find((entry) => entry.key === normalised)?.tone ?? 'mute';
}
