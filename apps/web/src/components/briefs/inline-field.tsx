'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { canEditBrief } from '@tas/domain/team';
import type { Role as ViewerRole } from '@tas/domain/roles';
import { ChipRow, DatePicker, Input, StatusChip, Textarea, type ChipOption } from '@tas/ui';

import type { BriefFieldSurface, BriefSectionField } from '@/app/app/creative-sheet/fields';
import { internalStatusView, statusView } from '@/app/app/creative-sheet/fields';

/**
 * `InlineField` (Phase B5 Fix A, 2026-10-15): the composite primitive the sidebar, the new-brief
 * dialog and the grid cell share for one field commit. It maps a `BriefFieldKind` to the right
 * `@tas/ui` editor and routes the commit through its `onUpdate` prop; the three parent surfaces
 * provide different onUpdate bodies (`updateBriefPartialAction` for most fields,
 * `moveCreativeSheetItemAction` for the status tracks — see commit 6's wire-up).
 *
 * SCOPE (D-034, docs/decisions.md 2026-10-15):
 *
 * - `text` / `richtext` / `url` → `<Input>` / `<Textarea>` with onBlur commit, 400ms debounce.
 * - `singleSelect` / `multiSelect` → `ChipRow` committing immediately on pick.
 * - `date` → `DatePicker`, immediate.
 * - `statusKey` → read-only `StatusChip` (the parent surfaces owns the status DROPDOWN; a
 *   status move needs the state-machine action, not an inline commit).
 * - `link` / `user` / `file` / `checkbox` → read-only chip with an "edit in full editor"
 *   affordance. The user's named need is text/select/date/richtext editability; these four
 *   open in the full brief page where their dedicated editors already live.
 *
 * ROLE GATE. `canEditBrief` is called before an editor is rendered; a false answer renders the
 * read-only variant with the same shape, so the row never jumps as the gate flips. The server
 * action re-runs the check — a disabled editor and an action refusal always agree.
 */
export interface InlineFieldProps {
  readonly brief: Readonly<Record<string, unknown>>;
  readonly field: BriefSectionField;
  readonly surface: BriefFieldSurface;
  readonly actorRole: ViewerRole | null | undefined;
  readonly actorUserId: string | null | undefined;
  readonly onUpdate: (patch: Readonly<Record<string, unknown>>) => Promise<void>;
  /** Options for a singleSelect / multiSelect field, when the caller has them pre-resolved. */
  readonly options?: readonly ChipOption[];
  /** The field's own id, so a <label htmlFor> can tie to it. Optional. */
  readonly id?: string;
  /** Optional className for the wrapper. */
  readonly className?: string;
}

const DEBOUNCE_MS = 400;

function stringOrEmpty(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function stringArrayOf(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string');
}

function isoDateOrNull(value: unknown): string | null {
  if (typeof value === 'string') {
    // Already an ISO or an ISO-date — pass through, truncate the time if any.
    return value.slice(0, 10);
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  return null;
}

/** The read-only placeholder for the four kinds InlineField does not yet edit (D-034). */
function ReadonlyChip({ label }: { readonly label: string }): React.ReactElement {
  return (
    <span
      data-slot="inline-field-readonly"
      className="inline-flex items-center rounded-input border border-line bg-surface px-2 py-1 font-mono text-xs text-text3"
    >
      {label}
    </span>
  );
}

/** The non-editable rendering, used when the role gate refuses or the kind falls through. */
function ReadonlyRendering({
  field,
  value,
}: {
  readonly field: BriefSectionField;
  readonly value: unknown;
}): React.ReactElement {
  if (field.kind === 'statusKey') {
    const view =
      field.name === 'internalStatus'
        ? internalStatusView(stringOrEmpty(value) || null)
        : statusView(stringOrEmpty(value) || null);
    if (view === null) return <ReadonlyChip label="Not set" />;
    return <StatusChip tone={view.tone} label={view.label} />;
  }
  if (field.kind === 'checkbox') {
    return <ReadonlyChip label={value === true ? 'Yes' : 'No'} />;
  }
  if (field.kind === 'multiSelect') {
    const values = stringArrayOf(value);
    if (values.length === 0) return <ReadonlyChip label="None" />;
    return <ReadonlyChip label={values.join(', ')} />;
  }
  const text = stringOrEmpty(value);
  return <ReadonlyChip label={text === '' ? 'Not set' : text} />;
}

/** The debounce handle: write once after the pause instead of on every keystroke. */
function useDebouncedCommit(
  onUpdate: InlineFieldProps['onUpdate'],
  fieldName: string,
): (next: unknown) => void {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef<unknown>(undefined);
  useEffect(() => {
    return () => {
      if (timer.current !== null) clearTimeout(timer.current);
    };
  }, []);
  return useCallback(
    (next: unknown) => {
      latest.current = next;
      if (timer.current !== null) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        timer.current = null;
        void onUpdate({ [fieldName]: latest.current });
      }, DEBOUNCE_MS);
    },
    [fieldName, onUpdate],
  );
}

export function InlineField({
  brief,
  field,
  surface,
  actorRole,
  actorUserId,
  onUpdate,
  options,
  id,
  className,
}: InlineFieldProps): React.ReactElement {
  const allowed = useMemo(
    () => canEditBrief({ actorRole, actorUserId, brief, fieldName: field.name }),
    [actorRole, actorUserId, brief, field.name],
  );

  // Optimistic local draft for debounced text/richtext editors — the UI shows the new value
  // immediately and rolls back on a failed commit.
  const current = brief[field.name];
  const [draft, setDraft] = useState<unknown>(current);
  useEffect(() => {
    setDraft(current);
  }, [current]);

  const commitPatch = useCallback(
    (next: unknown) => {
      // Fire and forget; the parent surface shows the toast and the roll-back on reject.
      void onUpdate({ [field.name]: next });
    },
    [field.name, onUpdate],
  );
  const debounced = useDebouncedCommit(onUpdate, field.name);

  if (!allowed) {
    // Guarded surface tag so a Playwright spec and a reader both see the state.
    return (
      <span
        data-slot="inline-field"
        data-surface={surface}
        data-allowed="false"
        className={className}
      >
        <ReadonlyRendering field={field} value={current} />
      </span>
    );
  }

  // The four kinds InlineField does not inline-edit (D-034). The user's named need is covered
  // by the other seven; link/user/file/checkbox stay readonly here and open in the full editor.
  if (
    field.kind === 'link' ||
    field.kind === 'user' ||
    field.kind === 'file' ||
    field.kind === 'checkbox' ||
    field.kind === 'statusKey'
  ) {
    return (
      <span
        data-slot="inline-field"
        data-surface={surface}
        data-kind={field.kind}
        data-allowed="true"
        className={className}
      >
        <ReadonlyRendering field={field} value={current} />
      </span>
    );
  }

  switch (field.kind) {
    case 'text':
    case 'url':
      return (
        <span
          data-slot="inline-field"
          data-surface={surface}
          data-kind={field.kind}
          className={className}
        >
          <Input
            id={id}
            type={field.kind === 'url' ? 'url' : 'text'}
            value={stringOrEmpty(draft)}
            onChange={(event) => {
              setDraft(event.target.value);
              debounced(event.target.value);
            }}
            onBlur={() => {
              commitPatch(stringOrEmpty(draft));
            }}
            aria-label={field.label}
            data-field={field.name}
          />
        </span>
      );
    case 'richtext':
      return (
        <span
          data-slot="inline-field"
          data-surface={surface}
          data-kind={field.kind}
          className={className}
        >
          <Textarea
            id={id}
            value={stringOrEmpty(draft)}
            onChange={(event) => {
              setDraft(event.target.value);
              debounced(event.target.value);
            }}
            onBlur={() => {
              commitPatch(stringOrEmpty(draft));
            }}
            aria-label={field.label}
            data-field={field.name}
          />
        </span>
      );
    case 'singleSelect':
      return (
        <span
          data-slot="inline-field"
          data-surface={surface}
          data-kind="singleSelect"
          className={className}
        >
          <ChipRow
            mode="single"
            value={typeof current === 'string' && current !== '' ? [current] : []}
            options={options ?? []}
            onChange={(next) => {
              commitPatch(next[0] ?? null);
            }}
            ariaLabel={field.label}
          />
        </span>
      );
    case 'multiSelect':
      return (
        <span
          data-slot="inline-field"
          data-surface={surface}
          data-kind="multiSelect"
          className={className}
        >
          <ChipRow
            mode="multi"
            value={stringArrayOf(current)}
            options={options ?? []}
            onChange={(next) => {
              commitPatch(next);
            }}
            ariaLabel={field.label}
          />
        </span>
      );
    case 'date':
      return (
        <span
          data-slot="inline-field"
          data-surface={surface}
          data-kind="date"
          className={className}
        >
          <DatePicker
            id={id}
            value={isoDateOrNull(current)}
            onChange={(next) => {
              commitPatch(next);
            }}
            ariaLabel={field.label}
          />
        </span>
      );
  }
}
