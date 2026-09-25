import {
  CLIENT_STATUS,
  chipTone,
  launchQueueActionsFor,
  type ChipTone,
  type CreativeTrack,
  type LaunchQueueActionKey,
} from '@tas/domain/state';

import type { BriefRow } from '@/lib/briefs-source';

/**
 * The Ads to Launch rows as the page renders them. Pure, and run on the server: every label, tone
 * and control is decided here once, so the client row renders what it is handed and never imports
 * `@tas/db` or resolves a status itself (the same split as the Client Queue's `fields.ts`).
 */

/** One control a row may draw — only the moves the domain says can succeed from where it is. */
export interface LaunchControl {
  readonly key: LaunchQueueActionKey;
  readonly label: string;
  readonly description: string;
}

export interface LaunchQueueItem {
  readonly id: string;
  /** The generated PRD §7 creative name; always rendered in `font-mono`. */
  readonly name: string;
  readonly href: string;
  readonly track: CreativeTrack;
  /** The brief's own format (`Video`, `Static`, …), shown beside the track icon. */
  readonly format: string;
  /** Generated, so `font-mono` too; null for a standalone static (PRD §8). */
  readonly conceptName: string | null;
  readonly angleName: string | null;
  readonly statusLabel: string;
  readonly statusTone: ChipTone;
  /** `P1`, `P2`, … or null when the media buyer set none. */
  readonly priorityLabel: string | null;
  /** The raw priority (1…10) or null — the value the editable dropdown starts on. */
  readonly priority: number | null;
  /** `YYYY-MM-DD HH:MM UTC`, or null before launch. */
  readonly launchedAtLabel: string | null;
  /** The creative file to download (PRD §11), or null when none is attached. */
  readonly downloadUrl: string | null;
  readonly controls: readonly LaunchControl[];
}

/** A client status as its chip: the domain's label and the tone that label earns. */
export function launchStatusView(status: string): { label: string; tone: ChipTone } {
  const entry = CLIENT_STATUS.find((candidate) => candidate.key === status);
  return entry === undefined
    ? { label: status, tone: 'mute' }
    : { label: entry.label, tone: chipTone(entry.label) };
}

/**
 * A launch moment in UTC, from the ISO string so the server and the browser print the same text (a
 * locale format would differ by machine and trip a hydration mismatch — see `ugc/fields.ts`).
 */
export function launchedAtLabel(value: Date | null): string | null {
  if (value === null || Number.isNaN(value.getTime())) {
    return null;
  }
  return `${value.toISOString().slice(0, 16).replace('T', ' ')} UTC`;
}

export function priorityLabel(priority: number | null): string | null {
  return priority === null ? null : `P${String(priority)}`;
}

/** The file a media buyer downloads: the design file link, else the first attached design file. */
export function downloadUrlOf(row: Pick<BriefRow, 'designFileUrl' | 'designFile'>): string | null {
  return row.designFileUrl ?? row.designFile?.[0] ?? null;
}

export function launchQueueItem(row: BriefRow, href: string): LaunchQueueItem {
  const status = launchStatusView(row.clientStatus);
  return {
    id: row.id,
    name: row.name,
    href,
    track: row.track,
    format: row.type,
    conceptName: row.conceptName,
    angleName: row.angleName,
    statusLabel: status.label,
    statusTone: status.tone,
    priorityLabel: priorityLabel(row.launchPriority),
    priority: row.launchPriority,
    launchedAtLabel: launchedAtLabel(row.launchedAt),
    downloadUrl: downloadUrlOf(row),
    controls: launchQueueActionsFor(row.track, row.internalStatus, row.clientStatus).map(
      (action) => ({ key: action.key, label: action.label, description: action.description }),
    ),
  };
}

export function launchCountLabel(count: number, noun: string): string {
  return `${String(count)} ${noun}${count === 1 ? '' : 's'}`;
}
