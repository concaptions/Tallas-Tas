import { ClientStatusBadge, formatCommentStamp, SectionLabel, StatusChip } from '@tas/ui';
import { CLIENT_STATUS, chipTone, internalStatusLabel } from '@tas/domain/state';
import { ArrowRight, Lock } from '@tas/ui/icons';

import type { BriefActivityItem } from '@/lib/briefs-source';

import { EM_DASH } from '../fields';
import {
  activityFieldLabel,
  activityValueTone,
  groupActivity,
  isQaTickField,
  type ActivityValueTone,
} from './activity-groups';

/** What the Activity section says before any write has been logged. */
export const NO_ACTIVITY_NOTE =
  'No activity yet. Every saved change is listed here with who made it.';

/** The shut-gate line under a reset group (B5.V5), board 5's `.gline.shut`. */
export const QA_RESET_NOTE = 'QA reset · Submit to Client re-locked';

export interface BriefActivityProps {
  /** The brief's activity log, newest first (EDIT-03). */
  readonly items: readonly BriefActivityItem[];
}

/** B5.V2: a tick set reads ok, a tick cleared reads bad, every other value stays quiet. */
const VALUE_TONE_CLASS: Readonly<Record<ActivityValueTone, string>> = {
  ok: 'text-ok',
  bad: 'text-bad',
  mute: 'text-text4',
};

/**
 * One side of a logged change. A status key renders as the chip its vocabulary gives it (B5.V1),
 * so a move reads `Ad Submitted → Revisions Needed` rather than two snake_case keys; the raw key
 * stays inside the slot for a screen reader and for the live spec, which reads the slot's text,
 * and on `data-value` for one that would rather read the attribute. A tick renders its `true` /
 * `false` in mono, toned; anything else is the stored text in mono, a dash for null.
 */
function Value({
  slot,
  field,
  value,
}: {
  readonly slot: 'brief-activity-old' | 'brief-activity-new';
  readonly field: string;
  readonly value: string | null;
}) {
  if (value !== null && field === 'internalStatus') {
    const label = internalStatusLabel(value);
    return (
      <span data-slot={slot} data-value={value} className="inline-flex">
        <StatusChip tone={chipTone(label)} label={label} />
      </span>
    );
  }
  if (value !== null && field === 'clientStatus') {
    return (
      <span data-slot={slot} data-value={value} className="inline-flex">
        <ClientStatusBadge
          vocabulary={CLIENT_STATUS}
          value={value}
          toneFor={(key) =>
            chipTone(CLIENT_STATUS.find((entry) => entry.key === key)?.label ?? key)
          }
        />
      </span>
    );
  }
  const tone = VALUE_TONE_CLASS[activityValueTone(field, value)];
  return (
    <span
      data-slot={slot}
      data-value={value ?? undefined}
      className={`font-mono ${isQaTickField(field) ? 'text-[10px]' : 'text-[11px]'} ${tone}`}
    >
      {value ?? EM_DASH}
    </span>
  );
}

/**
 * The brief's history (EDIT-03), drawn as board 5 draws a write (B5.V4): one card per write —
 * the actor and the stamp once in its header, then one row per field, label on the left and the
 * old → new pair on the right. A write that cleared QA while sending the creative back carries the
 * shut-gate line under its rows, so the reset reads as the one event it was. The rows come grouped
 * from `groupActivity`; every slot the specs address (`brief-activity-entry[data-field]`, `-actor`,
 * `-old`, `-new`, `-at`) survives, with `brief-activity-group` and `-reset` added around them.
 */
export function BriefActivity({ items }: BriefActivityProps) {
  const groups = groupActivity(items);
  return (
    <section
      data-slot="brief-activity"
      aria-labelledby="brief-activity-heading"
      className="flex min-w-0 flex-col gap-3 rounded-card border border-line bg-surface p-4"
    >
      <SectionLabel as="h2" id="brief-activity-heading">
        Activity
      </SectionLabel>
      {groups.length === 0 ? (
        <p data-slot="brief-activity-empty" className="py-4 text-center text-xs text-text4">
          {NO_ACTIVITY_NOTE}
        </p>
      ) : (
        <ol
          data-slot="brief-activity-list"
          className="flex max-h-80 flex-col gap-2 overflow-y-auto"
        >
          {groups.map((group) => (
            <li
              key={group.id}
              data-slot="brief-activity-group"
              data-reset={group.reset ? 'true' : undefined}
              className={`flex flex-col gap-2.5 rounded-card border bg-surface2 px-3.5 py-2.5 ${
                group.reset ? 'border-warn/40' : 'border-line'
              }`}
            >
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="font-medium text-text2" data-slot="brief-activity-actor">
                  {group.actorName ?? group.actorId ?? 'Someone'}
                </span>
                <time
                  dateTime={group.at}
                  title={group.at}
                  className="font-mono text-[10.5px] text-text4"
                  data-slot="brief-activity-at"
                >
                  {formatCommentStamp(group.at)}
                </time>
              </div>
              {group.entries.map((entry) => {
                const label = activityFieldLabel(entry.field);
                return (
                  <div
                    key={entry.id}
                    data-slot="brief-activity-entry"
                    data-field={entry.field}
                    title={entry.field}
                    className="flex items-center justify-between gap-3 text-xs"
                  >
                    {label === null ? (
                      <span className="font-mono text-[11px] text-text3">{entry.field}</span>
                    ) : (
                      <span className="text-text2">{label}</span>
                    )}
                    <span className="flex min-w-0 items-center gap-1.5">
                      <Value slot="brief-activity-old" field={entry.field} value={entry.oldValue} />
                      <ArrowRight aria-hidden="true" className="size-3 shrink-0 text-text4" />
                      <span className="sr-only">to</span>
                      <Value slot="brief-activity-new" field={entry.field} value={entry.newValue} />
                    </span>
                  </div>
                );
              })}
              {group.reset ? (
                <p
                  data-slot="brief-activity-reset"
                  className="mt-1 flex items-center gap-2 rounded-input border border-bad/30 bg-bad/10 px-3 py-2 text-[11px] text-bad"
                >
                  <Lock aria-hidden="true" className="size-3.5 shrink-0" />
                  {QA_RESET_NOTE}
                </p>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
