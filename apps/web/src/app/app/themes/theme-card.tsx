import type { ReactNode } from 'react';
import { Button, StatusChip } from '@tas/ui';

import { toggleThemeActiveAction } from './actions';
import {
  EMPTY_FIELD,
  THEME_FIELD_LABELS,
  UNRESOLVED_ASSIGNEE_HINT,
  assigneeValue,
  attachmentChipRow,
  overflowLabel,
  referenceChipRow,
  statusChip,
  textValue,
  themeCategoryLabel,
  themeCategoryTone,
  usageLabel,
  type ThemeCardRow,
} from './fields';

interface ThemeCardProps {
  readonly theme: ThemeCardRow;
  readonly demo: boolean;
  readonly onToggled: () => void;
}

/** The dash an empty row shows, so a label never sits over nothing. */
function EmptyField() {
  return <span className="text-text3">{EMPTY_FIELD}</span>;
}

interface FieldRowProps {
  readonly field: string;
  readonly label: string;
  readonly children: ReactNode;
}

/** One labelled row of the card's list: the Gratsi field's name, then its value. */
function FieldRow({ field, label, children }: FieldRowProps) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5" data-slot="theme-field" data-field={field}>
      <dt className="font-mono text-[10.5px] tracking-wide text-text3 uppercase">{label}</dt>
      <dd className="min-w-0 text-sm text-text2">{children}</dd>
    </div>
  );
}

/** A host-only or file-name link chip: a URL is 80 to 200 characters and would break the card. */
const linkChipClassName =
  'inline-flex items-center rounded-input border border-line bg-surface2 px-1.5 py-0.5 font-mono text-[11px] leading-none text-text3 hover:border-line2 hover:text-text2';

/**
 * One theme in the library grid (PRD §5.5). A CARD, never a table row: a theme is a thing you
 * browse and recognise, not a queue you work down, and a note that reads in two lines is the
 * reason anyone picks one theme over another.
 *
 * Three things, in this order, are the card's contract (ticket criterion 4): the name, the category
 * chip and the usage line. The name is the strategist's own words — themes are the one table whose
 * name is typed rather than generated — so it is `font-sans`, not `font-mono`.
 *
 * The category tone comes from `themeCategoryTone`, never from a local choice, so the same kind is
 * the same colour in the grid, in the filter row and on `/design-system`. The usage line is
 * `usageLabel` from `@tas/domain/themes`, which owns the zero and singular cases: "Used by no
 * brands yet", never "Used by 0 brands".
 *
 * Below the contract sit the Gratsi stored fields as a compact labelled list — Notes, Assignee,
 * Status, Attachments, Attachment Summary, in the base's own order — so every field reads under its
 * own name and an empty one reads as a dash rather than vanishing. The labels are
 * `THEME_FIELD_LABELS`; the status chip's tone and label come from the theme vocabulary through
 * `statusChip`; an assignee no user matches renders its stored value in `font-mono`, a system value
 * (`assigneeValue`). The note is clamped to two lines so every card in a row is the same height,
 * and the attachments and the reference links are both chips (`attachmentChipRow`,
 * `referenceChipRow`), because a swipe-file URL is 80 characters wide.
 *
 * Presentational and stateless, so the `/design-system` page mounts the identical element the grid
 * renders, and it takes `ThemeCardRow` rather than `ThemeListRow` so that preview can hand it a
 * plain object without importing `@tas/db`.
 */
export function ThemeCard({ theme, demo, onToggled }: ThemeCardProps) {
  const links = referenceChipRow(theme.referenceLinks);
  const note = textValue(theme.notes);
  const assignee = assigneeValue(theme);
  const status = statusChip(theme.status);
  const attachments = attachmentChipRow(theme.attachments);
  const summary = textValue(theme.aiAttachmentSummary);

  return (
    <article
      data-slot="theme-card"
      data-theme-id={theme.id}
      data-category={theme.category}
      className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4"
    >
      <div className="flex flex-col gap-2">
        <h3 className="text-base font-semibold text-text" data-slot="theme-name">
          {theme.name}
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          <StatusChip
            tone={themeCategoryTone(theme.category)}
            label={themeCategoryLabel(theme.category)}
          />
        </div>
        <p className="text-sm text-text3" data-slot="theme-usage">
          {usageLabel(theme.usedByBrandCount)}
        </p>
      </div>

      <dl className="flex flex-col gap-2.5 border-t border-line pt-3" data-slot="theme-fields">
        <FieldRow field="notes" label={THEME_FIELD_LABELS.notes}>
          {note === null ? (
            <EmptyField />
          ) : (
            <p data-slot="theme-note" title={note} className="line-clamp-2 leading-relaxed">
              {note}
            </p>
          )}
        </FieldRow>

        <FieldRow field="assignee" label={THEME_FIELD_LABELS.assignee}>
          {assignee === null ? (
            <EmptyField />
          ) : (
            <span
              data-slot="theme-assignee"
              data-resolved={assignee.mono ? 'false' : 'true'}
              title={assignee.mono ? UNRESOLVED_ASSIGNEE_HINT : undefined}
              className={assignee.mono ? 'font-mono text-xs' : undefined}
            >
              {assignee.text}
            </span>
          )}
        </FieldRow>

        <FieldRow field="status" label={THEME_FIELD_LABELS.status}>
          {status === null ? (
            <EmptyField />
          ) : (
            <StatusChip tone={status.tone} label={status.label} />
          )}
        </FieldRow>

        <FieldRow field="attachments" label={THEME_FIELD_LABELS.attachments}>
          {attachments.shown.length === 0 ? (
            <EmptyField />
          ) : (
            <span className="flex flex-wrap items-center gap-1.5" data-slot="theme-attachments">
              {attachments.shown.map((chip) => (
                <a
                  key={chip.url}
                  href={chip.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  title={chip.url}
                  data-slot="theme-attachment"
                  className={linkChipClassName}
                >
                  {chip.label}
                </a>
              ))}
              {attachments.overflow === 0 ? null : (
                <StatusChip tone="mute" label={overflowLabel(attachments.overflow)} />
              )}
            </span>
          )}
        </FieldRow>

        <FieldRow field="attachment-summary" label={THEME_FIELD_LABELS.attachmentSummary}>
          {summary === null ? (
            <EmptyField />
          ) : (
            <p
              data-slot="theme-attachment-summary"
              title={summary}
              className="line-clamp-3 leading-relaxed"
            >
              {summary}
            </p>
          )}
        </FieldRow>
      </dl>

      {links.shown.length === 0 ? null : (
        <div className="flex flex-wrap items-center gap-1.5" data-slot="theme-links">
          {links.shown.map((chip) => (
            <a
              key={chip.url}
              href={chip.url}
              target="_blank"
              rel="noreferrer noopener"
              title={chip.url}
              data-slot="theme-link"
              className={linkChipClassName}
            >
              {chip.host}
            </a>
          ))}
          {links.overflow === 0 ? null : (
            <StatusChip tone="mute" label={overflowLabel(links.overflow)} />
          )}
        </div>
      )}

      {demo ? null : (
        <form
          action={async (formData: FormData) => {
            await toggleThemeActiveAction(formData);
            onToggled();
          }}
          className="mt-auto pt-1"
        >
          <input type="hidden" name="id" value={theme.id} />
          <input type="hidden" name="isActive" value={theme.isActive ? 'false' : 'true'} />
          <Button
            type="submit"
            variant="outline"
            size="sm"
            data-slot="theme-toggle-active"
            className="text-xs"
          >
            {theme.isActive ? 'Archive' : 'Restore'}
          </Button>
        </form>
      )}
    </article>
  );
}
