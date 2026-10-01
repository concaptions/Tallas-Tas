'use client';

import { useActionState, useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import type { AngleListRow } from '@tas/db';
import { validateAngleDraft, type AngleTypeKey } from '@tas/domain/angles';
import {
  Button,
  DEMO_WRITE_HINT,
  disabledWriteClassName,
  DisabledWrite,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SoonChip,
  StatusChip,
  Textarea,
} from '@tas/ui';

import { LinkField } from '@/components/links/link-field';

import { createAngleAction, updateAngleAction, type AngleActionResult } from './actions';
import {
  AD_INSPO_LABEL,
  ANGLE_FIELD_GROUPS,
  ANGLE_FORMATS,
  ANGLE_NOTE_FIELDS,
  ANGLE_STATUS_OPTIONS,
  ANGLE_TYPES,
  APPROVAL_HEADING,
  ASSESSMENT_HEADING,
  CONCEPTS_LABEL,
  CREATIVE_DESIGNS_LABEL,
  CREATIVE_MODULE_CHIP_TONE,
  FORMATS_LABEL,
  INSPIRATION_HEADING,
  NO_AD_INSPO_NOTICE,
  NO_CONCEPTS_NOTICE,
  NO_CREATIVE_DESIGNS_NOTICE,
  NONE_VALUE,
  NOT_SET,
  NOTES_HEADING,
  POTENTIAL_FIELD,
  STATUS_LABEL,
  TYPE_SOON_HINT,
  WINNING_LABEL,
  angleStatusView,
  type AngleFieldName,
  type AngleProseField,
  type LinkedRecord,
} from './fields';

/** The `?angle=` value that means "the panel is open on an angle that does not exist yet". */
export const NEW_ANGLE = 'new';

/** What the demo footer says instead of offering a save. */
export const DEMO_FOOTER_NOTICE = 'Demo mode — changes are not saved';

/** One row of a dropdown: the linked table's id and the name a strategist recognises. */
export interface LinkOption {
  readonly id: string;
  readonly name: string;
}

interface AnglePanelProps {
  readonly angle: AngleListRow | null;
  readonly personas: readonly LinkOption[];
  readonly products: readonly LinkOption[];
  /** The brand's concepts, for the two-way Concepts field (`concept_angles`, LINK-01). */
  readonly conceptOptions?: readonly LinkOption[];
  /** The concept ids linked to the angle today, from the same junction the concept page writes. */
  readonly conceptIds?: readonly string[];
  /** The creative modules that link this angle (`creative_module_angles`), read-only. */
  readonly creativeModules: readonly LinkedRecord[];
  /**
   * The concepts paired with this angle (`concept_angles`, inverted by `indexConceptsByAngle`) and
   * the briefs whose `creative_briefs.angle_id` is this angle (`indexCreativeDesignsByAngle`), both
   * read-only and both built by the page. Required, like `creativeModules`: a default here would
   * let a caller forget the list and render a label over a permanently empty sentence.
   */
  readonly concepts: readonly LinkedRecord[];
  readonly creativeDesigns: readonly LinkedRecord[];
  readonly demo: boolean;
  readonly onClose: () => void;
  readonly onSaved: (id: string) => void;
}

/** What the Creative modules list says when no module links the angle. */
export const NO_CREATIVE_MODULES_NOTICE =
  'No creative module groups this angle yet. Link it from the module’s panel.';

/**
 * One read-only linked record: the shared chip, wrapped in a link when the record has somewhere to
 * go. Never a button and never a picker — the link is owned by the other table, and this is its
 * reflection.
 */
function LinkedRecordChip({ record, slot }: { record: LinkedRecord; slot: string }) {
  const chip = <StatusChip tone={record.chip ?? CREATIVE_MODULE_CHIP_TONE} label={record.label} />;
  if (record.href === undefined) {
    return (
      <span data-slot={slot} data-record-id={record.id}>
        {chip}
      </span>
    );
  }
  return (
    <Link
      href={record.href}
      data-slot={slot}
      data-record-id={record.id}
      className="rounded-input transition-opacity hover:opacity-80"
    >
      {chip}
    </Link>
  );
}

interface LinkedWorkListProps {
  readonly title: string;
  readonly records: readonly LinkedRecord[];
  readonly empty: string;
  /** The `data-slot` of the list, and the one each row carries. */
  readonly slot: string;
  readonly rowSlot: string;
}

/**
 * One read-only list of records another module links to this angle, in the shape of the Products
 * panel's lists: each row is the record's generated name (always `font-mono` — a concept's
 * Batch-Angle-Theme and a brief's §7 name are system output) as a link to where it lives, beside
 * its status chip. Nothing here is a control: these links are edited from the other end, and the
 * empty sentence says where.
 */
function LinkedWorkList({ title, records, empty, slot, rowSlot }: LinkedWorkListProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] tracking-wide text-text3 uppercase">{title}</span>
      {records.length === 0 ? (
        <div data-slot={slot} className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-text3">{empty}</span>
        </div>
      ) : (
        <ul data-slot={slot} className="flex flex-col gap-1.5">
          {records.map((record) => (
            <li
              key={record.id}
              data-slot={rowSlot}
              data-record-id={record.id}
              className="flex flex-wrap items-center gap-2"
            >
              {record.href === undefined ? (
                <span className="font-mono text-sm text-text">{record.label}</span>
              ) : (
                <Link
                  href={record.href}
                  className="font-mono text-sm text-text underline-offset-2 hover:underline"
                >
                  {record.label}
                </Link>
              )}
              {record.status === undefined ? null : (
                <StatusChip tone={record.status.tone} label={record.status.label} />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** The stored value of one prose field, as the form's default. */
function valueOf(angle: AngleListRow | null, name: AngleFieldName): string {
  if (angle === null) {
    return '';
  }
  const value = angle[name as keyof AngleListRow];
  return typeof value === 'string' ? value : '';
}

/**
 * The link editor always keeps one empty input at the bottom, so adding a link is typing rather
 * than clicking "Add" first. The action drops blank entries before it writes, which is what makes
 * that safe.
 */
function linkRowsOf(angle: AngleListRow | null): string[] {
  return [...(angle?.adInspoLinks ?? []), ''];
}

/**
 * The right-side angle panel (PRD §5.6). Deliberately not a modal: no backdrop, no focus trap, no
 * `aria-modal` — the table beside it stays visible and clickable while this is open, which is the
 * point of a panel. It is fixed to the right edge at 60% of the viewport, full width under 900px,
 * and it closes on Escape or on its close button.
 *
 * Six groups, in the order `fields.ts` states: Identity, Hypothesis, Pain Points, USP, Targeting
 * and Resources. Persona and Product are `Select` dropdowns over the rows the page loaded, never
 * free text, each with an explicit "None" whose value is `''` — which is exactly what the Server
 * Action stores as NULL. "Formats to create" are toggles that submit one repeated `formats` entry
 * per selection, through hidden inputs so the toggles themselves post nothing; Type is rendered the
 * same way but inert, because this page does not write that column yet, so it carries a `SoonChip`
 * and says so on hover rather than pretending a click was saved.
 *
 * The save button is disabled by `validateAngleDraft` from `@tas/domain/angles` — the same function
 * the Server Action re-runs before it writes. No rule is restated here. In demo mode every write is
 * disabled through `DisabledWrite` and the footer says so instead of saving.
 *
 * Below the six groups sit four more sections, none of them a field group, so the six-heading
 * contract on `angle-group-heading` holds:
 *
 * - "Inspiration": the Ad Inspo link editor, one URL per row with an empty row always at the
 *   bottom, each row a repeated `adInspoLinks` entry — the pattern of the concept detail's editor.
 * - "Assessment": Potential (free text; the Kanban groups on it) and the Winning checkbox, the
 *   strategist's own read of the angle.
 * - "Approval": the Status select over `angleStatuses` (Gratsi's client-approval track, a
 *   different axis from the assessment), with the shared `StatusChip` beside it in the tone
 *   `fields.ts` gives the chosen key. "Not set" submits `''`, which the action stores as NULL.
 * - "Notes": Internal Notes (team only) and Client Notes.
 *
 * Last, an existing angle shows "Linked work": the creative modules that link it through
 * `creative_module_angles`, the concepts paired with it through `concept_angles` and the briefs
 * whose `angle_id` it is — the pattern of the Products panel's reverse lists. Every list is
 * read-only here (each link is owned by the other table and each row links there), so it sits
 * outside the form's fields and posts nothing. A new angle has no links yet and no section.
 */
export function AnglePanel({
  angle,
  personas,
  products,
  conceptOptions = [],
  conceptIds = [],
  creativeModules,
  concepts,
  creativeDesigns,
  demo,
  onClose,
  onSaved,
}: AnglePanelProps) {
  const creating = angle === null;
  const action = creating ? createAngleAction : updateAngleAction;
  const [state, formAction, pending] = useActionState<AngleActionResult | null, FormData>(
    action,
    null,
  );

  const [name, setName] = useState(valueOf(angle, 'name'));
  const [personaIds, setPersonaIds] = useState<readonly string[]>(angle?.personaIds ?? []);
  const [productIds, setProductIds] = useState<readonly string[]>(angle?.productIds ?? []);
  const [status, setStatus] = useState<string>(angle?.status ?? NONE_VALUE);
  const [formats, setFormats] = useState<readonly string[]>(angle?.formats ?? []);
  const [links, setLinks] = useState<readonly string[]>(() => linkRowsOf(angle));
  const [winning, setWinning] = useState(angle?.winning ?? false);

  const types: readonly AngleTypeKey[] = angle?.type ?? [];

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  useEffect(() => {
    if (state !== null && state.ok) {
      onSaved(state.id);
    }
  }, [state, onSaved]);

  const draft = useMemo(
    () =>
      validateAngleDraft({
        name,
        personaIds,
        formats,
        adInspoLinks: links,
      }),
    [name, personaIds, formats, links],
  );

  /** A toggled set stays in the vocabulary's order, whatever order the clicks came in. */
  const toggleFormat = (key: string) => {
    setFormats((current) =>
      current.includes(key)
        ? current.filter((entry) => entry !== key)
        : ANGLE_FORMATS.map((entry) => entry.key).filter(
            (entry) => entry === key || current.includes(entry),
          ),
    );
  };

  const editLink = (index: number, value: string) => {
    setLinks((current) => {
      const next = current.map((entry, position) => (position === index ? value : entry));
      return next[next.length - 1] === '' ? next : [...next, ''];
    });
  };

  const removeLink = (index: number) => {
    setLinks((current) => {
      const next = current.filter((_, position) => position !== index);
      return next.length === 0 || next[next.length - 1] !== '' ? [...next, ''] : next;
    });
  };

  /** The server's message for a field, or — while editing — the domain's own. */
  const fieldError = (field: AngleFieldName): string | undefined => {
    if (state !== null && !state.ok && state.fieldErrors?.[field] !== undefined) {
      return state.fieldErrors[field];
    }
    return undefined;
  };

  /** Why the save is inert, in the order a strategist can act on. */
  const blockedHint = demo
    ? DEMO_WRITE_HINT
    : (Object.values(draft.fieldErrors)[0] ?? 'Nothing to save yet.');
  const blocked = demo || !draft.ok;

  const renderProse = (field: AngleProseField) => {
    const id = `angle-field-${field.name}`;
    const error = fieldError(field.name);
    const single = field.name === 'name';

    return (
      <div key={field.name} className="flex flex-col gap-1.5">
        <Label htmlFor={id} className="text-[11px] tracking-wide text-text3 uppercase">
          {field.label}
        </Label>
        {field.hint === undefined ? null : <p className="text-xs text-text3">{field.hint}</p>}
        {single ? (
          <Input
            id={id}
            name={field.name}
            readOnly={demo}
            aria-invalid={error !== undefined}
            placeholder={NOT_SET}
            value={name}
            onChange={(event) => {
              setName(event.target.value);
            }}
          />
        ) : (
          <Textarea
            id={id}
            name={field.name}
            readOnly={demo}
            aria-invalid={error !== undefined}
            placeholder={NOT_SET}
            defaultValue={valueOf(angle, field.name)}
            className="min-h-24 leading-relaxed"
          />
        )}
        {error === undefined ? null : <p className="text-xs text-bad">{error}</p>}
      </div>
    );
  };

  /**
   * The "Formats to create" toggles: all four vocabulary entries, the chosen ones pressed. The
   * buttons post nothing themselves — the hidden `formats` inputs at the top of the form carry the
   * set — so a click changes state and the next save round-trips it. Disabled in demo mode like
   * every other write, and wrapped the same way, because a disabled button receives no pointer
   * events and could not carry its own tooltip. `disabledWriteClassName` is deliberately not
   * applied: it would flatten the row onto one surface and erase which formats are selected, the
   * one thing a read-only visitor came to see.
   */
  const renderFormats = () => {
    const error = fieldError('formats') ?? draft.fieldErrors.formats;

    return (
      <div className="flex flex-col gap-1.5">
        <Label className="text-[11px] tracking-wide text-text3 uppercase">{FORMATS_LABEL}</Label>
        <DisabledWrite active={demo} hint={DEMO_WRITE_HINT} className="w-full">
          <div
            className="flex flex-wrap gap-2"
            role="group"
            aria-label={FORMATS_LABEL}
            data-slot="angle-formats"
          >
            {ANGLE_FORMATS.map((entry) => {
              const on = formats.includes(entry.key);
              return (
                <button
                  key={entry.key}
                  type="button"
                  disabled={demo}
                  aria-pressed={on}
                  data-slot="format-toggle"
                  data-format={entry.key}
                  onClick={() => {
                    toggleFormat(entry.key);
                  }}
                  className={
                    on
                      ? 'rounded-input border border-accent-line bg-accent-soft px-2.5 py-1 font-mono text-[11px] tracking-wide text-accent uppercase disabled:cursor-not-allowed'
                      : 'rounded-input border border-line bg-surface2 px-2.5 py-1 font-mono text-[11px] tracking-wide text-text3 uppercase hover:border-line2 hover:text-text2 disabled:cursor-not-allowed'
                  }
                >
                  {entry.label}
                </button>
              );
            })}
          </div>
        </DisabledWrite>
        {error === undefined ? null : <p className="text-xs text-bad">{error}</p>}
      </div>
    );
  };

  /**
   * The Ad Inspo link editor: one URL per row, each a repeated `adInspoLinks` entry, with an empty
   * row always at the bottom so adding a link is typing. The domain's message names the row that
   * is not a link; the action drops blank rows before it writes.
   */
  const renderAdInspo = () => {
    const error = fieldError('adInspoLinks') ?? draft.fieldErrors.adInspoLinks;
    const saved = links.filter((url) => url.trim() !== '');

    return (
      <div className="flex flex-col gap-2" data-slot="angle-ad-inspo">
        <Label className="text-[11px] tracking-wide text-text3 uppercase">{AD_INSPO_LABEL}</Label>
        <p className="text-xs text-text3">
          One reference ad per row, as its full http(s) URL. A blank row is ignored.
        </p>
        {links.map((url, index) => (
          <div key={`row-${String(index)}`} className="flex items-center gap-2">
            <Input
              name="adInspoLinks"
              value={url}
              readOnly={demo}
              aria-label={`Ad inspiration ${String(index + 1)}`}
              placeholder="https://www.facebook.com/ads/library/?id=…"
              data-slot="angle-inspo-input"
              onChange={(event) => {
                editLink(index, event.target.value);
              }}
              className="font-mono text-xs"
            />
            {demo || url === '' ? null : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={`Remove ad inspiration ${String(index + 1)}`}
                onClick={() => {
                  removeLink(index);
                }}
              >
                Remove
              </Button>
            )}
          </div>
        ))}
        {saved.length === 0 ? (
          <p className="text-xs text-text4" data-slot="angle-ad-inspo-empty">
            {NO_AD_INSPO_NOTICE}
          </p>
        ) : null}
        {error === undefined ? null : <p className="text-xs text-bad">{error}</p>}
      </div>
    );
  };

  /**
   * The Winning checkbox, the pattern of the Meta Copywriting panel's: the box holds the state and
   * a hidden input carries `"true"` or `"false"`, so an unticked box still posts a value the
   * action can tell apart from a form that never had the control.
   */
  const renderWinning = () => {
    const id = 'angle-field-winning';
    const error = fieldError('winning');

    return (
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-3" data-slot="angle-winning">
          <input
            id={id}
            type="checkbox"
            checked={winning}
            disabled={demo}
            onChange={(event) => {
              setWinning(event.target.checked);
            }}
            className="size-4 shrink-0 rounded-input border border-line2 bg-surface2 accent-accent disabled:cursor-not-allowed"
          />
          <Label htmlFor={id} className="text-[11px] tracking-wide text-text3 uppercase">
            {WINNING_LABEL}
          </Label>
        </div>
        <input type="hidden" name="winning" value={String(winning)} />
        <p className="text-xs text-text3">
          Ticked once this angle has produced a winning creative.
        </p>
        {error === undefined ? null : <p className="text-xs text-bad">{error}</p>}
      </div>
    );
  };

  /**
   * The Status select, the dropdowns' pattern plus the chip: the vocabulary's labels as options,
   * its keys as values, the chip in the chosen key's tone, and a hidden input carrying the key —
   * or `''` for "Not set", which the action stores as NULL.
   */
  const renderStatus = () => {
    const id = 'angle-field-status';
    const error = fieldError('status');
    const view = angleStatusView(status === NONE_VALUE ? null : status);

    return (
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={id} className="text-[11px] tracking-wide text-text3 uppercase">
          {STATUS_LABEL}
        </Label>
        <div className="flex items-center gap-2">
          <Select
            value={status === NONE_VALUE ? undefined : status}
            onValueChange={setStatus}
            disabled={demo}
          >
            <SelectTrigger
              id={id}
              className="w-full"
              aria-label={STATUS_LABEL}
              data-slot="angle-status"
            >
              <SelectValue placeholder={NOT_SET} />
            </SelectTrigger>
            <SelectContent>
              {ANGLE_STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.key} value={option.key}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {view === null ? null : <StatusChip tone={view.tone} label={view.label} />}
        </div>
        <input type="hidden" name="status" value={status} />
        {status === NONE_VALUE || demo ? null : (
          <button
            type="button"
            onClick={() => {
              setStatus(NONE_VALUE);
            }}
            className="self-start rounded-input text-xs text-text3 underline-offset-2 hover:text-text2 hover:underline"
          >
            Clear {STATUS_LABEL.toLowerCase()}
          </button>
        )}
        {error === undefined ? null : <p className="text-xs text-bad">{error}</p>}
      </div>
    );
  };

  /** One section under the six groups. Its heading slot is its own, never `angle-group-heading`. */
  const renderSection = (slot: string, heading: string, body: ReactNode) => (
    <section className="flex flex-col gap-3">
      <h3 data-slot={slot} className="border-b border-line pb-1 text-sm font-medium text-text2">
        {heading}
      </h3>
      <div className="flex flex-col gap-4">{body}</div>
    </section>
  );

  return (
    <aside
      data-slot="angle-panel"
      aria-label={creating ? 'New angle' : `Angle: ${angle.name}`}
      className="fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l border-line bg-surface shadow-lg min-[900px]:w-[60%]"
    >
      <header className="flex items-start justify-between gap-3 border-b border-line px-4 py-3 sm:px-6">
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="font-mono text-[11px] tracking-wide text-text3 uppercase">
            {creating ? 'New angle' : 'Angle'}
          </p>
          <h2 className="truncate text-lg font-semibold text-text" data-slot="angle-panel-title">
            {creating ? 'New angle' : angle.name}
          </h2>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClose}
          aria-label="Close panel"
          data-slot="angle-panel-close"
        >
          Close
        </Button>
      </header>

      <form action={formAction} className="flex min-h-0 flex-1 flex-col">
        {creating ? null : <input type="hidden" name="id" value={angle.id} />}
        {formats.map((key) => (
          <input key={key} type="hidden" name="formats" value={key} />
        ))}

        <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          <div className="flex flex-col gap-7">
            {ANGLE_FIELD_GROUPS.map((group) => (
              <section key={group.heading} className="flex flex-col gap-3">
                <h3
                  data-slot="angle-group-heading"
                  className="flex items-center gap-2 border-b border-line pb-1 text-sm font-medium text-text2"
                >
                  {group.heading}
                </h3>

                <div className="flex flex-col gap-4">
                  {group.fields.map(renderProse)}

                  {group.heading === 'Targeting' ? (
                    <>
                      {/* The same LinkField the persona and product panels mount for their angles
                          (LINK-01): one junction row per pair, written on the spot for a saved angle,
                          posted as hidden inputs so the Save re-syncs the same set. */}
                      <div className="grid gap-4 sm:grid-cols-2">
                        <LinkField
                          link="angle-personas"
                          sourceId={angle?.id ?? null}
                          options={personas}
                          selectedIds={personaIds}
                          onChange={setPersonaIds}
                          inputName="personaId"
                          label="Persona"
                          demo={demo}
                          error={fieldError('personaId')}
                          slot="angle-personaId"
                          empty="No persona yet. Pick who this angle is written for."
                        />
                        <LinkField
                          link="angle-products"
                          sourceId={angle?.id ?? null}
                          options={products}
                          selectedIds={productIds}
                          onChange={setProductIds}
                          inputName="productId"
                          label="Product"
                          demo={demo}
                          error={fieldError('productId')}
                          slot="angle-productId"
                          empty="No product yet. Pick what this angle sells."
                        />
                      </div>
                      {angle === null ? null : (
                        <LinkField
                          link="angle-concepts"
                          sourceId={angle.id}
                          options={conceptOptions}
                          selectedIds={conceptIds}
                          label="Concepts"
                          demo={demo}
                          slot="angle-concept-links"
                          empty="No concept is built on this angle yet. Link one here or from the concept's page."
                        />
                      )}

                      {renderFormats()}

                      <div className="flex flex-col gap-1.5">
                        <Label className="flex items-center gap-2 text-[11px] tracking-wide text-text3 uppercase">
                          Type
                          <SoonChip />
                        </Label>
                        <DisabledWrite hint={TYPE_SOON_HINT} className="w-full">
                          <div
                            className="flex flex-wrap gap-2"
                            role="group"
                            aria-label="Type"
                            data-slot="angle-types"
                          >
                            {ANGLE_TYPES.map((entry) => {
                              const on = types.includes(entry.key);
                              return (
                                <button
                                  key={entry.key}
                                  type="button"
                                  disabled
                                  aria-pressed={on}
                                  data-slot="type-toggle"
                                  data-type={entry.key}
                                  className={
                                    on
                                      ? 'rounded-input border border-line2 bg-surface3 px-2.5 py-1 font-mono text-[11px] tracking-wide text-text2 uppercase'
                                      : 'rounded-input border border-line bg-surface2 px-2.5 py-1 font-mono text-[11px] tracking-wide text-text4 uppercase'
                                  }
                                >
                                  {entry.label}
                                </button>
                              );
                            })}
                          </div>
                        </DisabledWrite>
                      </div>
                    </>
                  ) : null}

                  {group.heading === 'Resources'
                    ? group.fields.map((field) => {
                        const id = `angle-field-${field.name}`;
                        const error = fieldError(field.name);
                        return (
                          <div key={field.name} className="flex flex-col gap-1.5">
                            <Label
                              htmlFor={id}
                              className="text-[11px] tracking-wide text-text3 uppercase"
                            >
                              {field.label}
                            </Label>
                            {field.hint === undefined ? null : (
                              <p className="text-xs text-text3">{field.hint}</p>
                            )}
                            <Input
                              id={id}
                              name={field.name}
                              type="url"
                              readOnly={demo}
                              aria-invalid={error !== undefined}
                              placeholder="https://…"
                              defaultValue={valueOf(angle, field.name)}
                              className="font-mono text-xs"
                            />
                            {error === undefined ? null : (
                              <p className="text-xs text-bad">{error}</p>
                            )}
                          </div>
                        );
                      })
                    : null}
                </div>
              </section>
            ))}

            {renderSection('angle-inspiration-heading', INSPIRATION_HEADING, renderAdInspo())}

            {renderSection(
              'angle-assessment-heading',
              ASSESSMENT_HEADING,
              <>
                {renderProse(POTENTIAL_FIELD)}
                {renderWinning()}
              </>,
            )}

            {renderSection('angle-approval-heading', APPROVAL_HEADING, renderStatus())}

            {renderSection(
              'angle-notes-heading',
              NOTES_HEADING,
              ANGLE_NOTE_FIELDS.map(renderProse),
            )}

            {creating ? null : (
              <section className="flex flex-col gap-3">
                <h3
                  data-slot="angle-linked-heading"
                  className="border-b border-line pb-1 text-sm font-medium text-text2"
                >
                  Linked work
                </h3>
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[11px] tracking-wide text-text3 uppercase">
                      Creative modules
                    </span>
                    <div
                      className="flex flex-wrap items-center gap-2"
                      data-slot="angle-creative-modules"
                    >
                      {creativeModules.length === 0 ? (
                        <span className="text-xs text-text3">{NO_CREATIVE_MODULES_NOTICE}</span>
                      ) : (
                        creativeModules.map((record) => (
                          <LinkedRecordChip
                            key={record.id}
                            record={record}
                            slot="angle-creative-module"
                          />
                        ))
                      )}
                    </div>
                    <p className="text-xs text-text3">
                      Modules that group this angle. Read-only here; a module picks its angles from
                      its own panel.
                    </p>
                  </div>

                  <LinkedWorkList
                    title={CONCEPTS_LABEL}
                    records={concepts}
                    empty={NO_CONCEPTS_NOTICE}
                    slot="angle-concepts"
                    rowSlot="angle-concept"
                  />

                  <LinkedWorkList
                    title={CREATIVE_DESIGNS_LABEL}
                    records={creativeDesigns}
                    empty={NO_CREATIVE_DESIGNS_NOTICE}
                    slot="angle-creative-designs"
                    rowSlot="angle-creative-design"
                  />
                </div>
              </section>
            )}
          </div>
        </div>

        <footer className="sticky bottom-0 flex flex-wrap items-center justify-end gap-3 border-t border-line bg-surface2 px-4 py-3 sm:px-6">
          {demo ? (
            <p className="mr-auto text-xs text-text3" data-slot="angle-demo-note">
              {DEMO_FOOTER_NOTICE}
            </p>
          ) : state !== null && !state.ok ? (
            <p className="mr-auto text-xs text-bad">{state.error}</p>
          ) : null}
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <DisabledWrite active={blocked} hint={blockedHint}>
            <Button
              type="submit"
              size="sm"
              disabled={blocked || pending}
              data-slot="angle-save"
              className={disabledWriteClassName}
            >
              {pending ? 'Saving…' : 'Save'}
            </Button>
          </DisabledWrite>
        </footer>
      </form>
    </aside>
  );
}
