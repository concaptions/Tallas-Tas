'use client';

import { useActionState, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { isHttpUrl } from '@tas/domain/angles';
import {
  inheritedFromAngle,
  validateConceptDraft,
  type InheritedAngle,
} from '@tas/domain/concepts';
import type { ClientStatusKey, CreativeTrack, InternalStatusKey } from '@tas/domain/state';
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
  Textarea,
  TwoTrackApproval,
} from '@tas/ui';

import { conceptPath, conceptsPath } from '@/lib/routes';

import { createConceptAction, updateConceptAction, type ConceptActionResult } from '../actions';
import {
  ANGLE_FORMATS,
  BATCHES,
  CONCEPT_APPROVAL_STATUSES,
  CONCEPT_CATEGORIES,
  CONCEPT_GROUPS,
  CONCEPT_PRODUCTION_STATUSES,
  CONCEPT_STYLES,
  DEMO_FOOTER_NOTICE,
  EM_DASH,
  FROM_ANGLE,
  NAME_PART_LABELS,
  NONE_VALUE,
  NOT_SET,
  type AngleFormatKey,
  type ConceptFieldName,
} from '../fields';
import { NamePreview } from './name-preview';

/**
 * One angle, with everything a concept reads off it. Structural rather than `@tas/db`'s
 * `AngleListRow`, so this client component never imports the database package: it satisfies
 * `InheritedAngle` from `@tas/domain/concepts`, which is what fills the read-only block.
 */
export interface AngleOption extends InheritedAngle {
  readonly id: string;
  readonly name: string;
}

/** One theme of the GLOBAL library. A concept shows the name; the pairing stores the id. */
export interface ThemeOption {
  readonly id: string;
  readonly name: string;
}

/** One creator from the brand's roster. The concept links to a creator for production. */
export interface CreatorOption {
  readonly id: string;
  readonly name: string;
}

/** The columns this page edits. `name` is absent on purpose: it is generated, never held. */
export interface ConceptFormValues {
  readonly id: string;
  readonly batch: string | null;
  readonly angleId: string | null;
  readonly themeId: string | null;
  readonly category: string | null;
  readonly conceptStyle: string | null;
  readonly formats: readonly string[];
  readonly adInspoLinks: readonly string[];
  readonly hookExamples: string | null;
  readonly scriptIdea: string | null;
  readonly approvalStatus: string | null;
  readonly productionStatus: string | null;
  readonly formatsToCreate: readonly string[];
  readonly creatorId: string | null;
}

interface ConceptDetailProps {
  /** `null` while creating: the same form, submitted to `createConceptAction`. */
  readonly concept: ConceptFormValues | null;
  readonly angles: readonly AngleOption[];
  readonly themes: readonly ThemeOption[];
  readonly creators: readonly CreatorOption[];
  /** Which internal track this concept runs on, resolved on the server beside the data source. */
  readonly track: CreativeTrack;
  readonly internal: InternalStatusKey;
  readonly client: ClientStatusKey;
  readonly demo: boolean;
}

/** The link editor keeps one empty input at the bottom, so adding a link is typing, not clicking. */
function linkRowsOf(concept: ConceptFormValues | null): string[] {
  return [...(concept?.adInspoLinks ?? []), ''];
}

/**
 * The Concepts detail page (PRD §5.7, ticket criteria 6–10, 12).
 *
 * A PAGE, not a panel. A concept carries a generated name, a pairing, five inherited fields, a
 * brief and an approval rail — a page's worth of material, and a URL worth sending to the editor
 * who has to shoot it.
 *
 * THE NAME IS NOT A FIELD. It is a heading, rendered by `NamePreview` from `conceptName`, and it
 * re-renders on every change of the three dropdowns below it with no round trip. There is no input
 * holding it, hidden or otherwise, and the Server Action ignores anything a form claims it is
 * called: it re-derives the name from the angle and theme rows it reads itself. That is what makes
 * a stored name unable to drift from its parts (CLAUDE.md non-negotiable 6).
 *
 * THE INHERITED BLOCK IS NOT EDITABLE. `inheritedFromAngle` from `@tas/domain/concepts` owns which
 * five fields a concept reads off its angle, so this page cannot disagree with the action about
 * what is writable: a field that appears there is a field nothing may write. They are `<p>`s under
 * the caption "from Angle", never disabled inputs, and they re-fill the moment the Angle dropdown
 * changes because they are read off the selected option rather than off the saved row.
 *
 * THE RAIL IS THE SHARED WIDGET. `TwoTrackApproval` from `@tas/ui` with `clientOnly={false}`, fed
 * this concept's two stored statuses. The gate is `isClientTrackOpen` inside that component; this
 * page does not compute it, does not dim anything itself and does not decide what "Approved" means.
 *
 * Save is disabled by `validateConceptDraft` — the same function the action re-runs — and by demo
 * mode, through `DisabledWrite` + `disabledWriteClassName`, with the reason on hover.
 */
export function ConceptDetail({
  concept,
  angles,
  themes,
  creators,
  track,
  internal,
  client,
  demo,
}: ConceptDetailProps) {
  const router = useRouter();
  const creating = concept === null;
  const action = creating ? createConceptAction : updateConceptAction;
  const [state, formAction, pending] = useActionState<ConceptActionResult | null, FormData>(
    action,
    null,
  );

  const [batch, setBatch] = useState(concept?.batch ?? NONE_VALUE);
  const [angleId, setAngleId] = useState(concept?.angleId ?? NONE_VALUE);
  const [themeId, setThemeId] = useState(concept?.themeId ?? NONE_VALUE);
  const [category, setCategory] = useState(concept?.category ?? NONE_VALUE);
  const [conceptStyle, setConceptStyle] = useState(concept?.conceptStyle ?? NONE_VALUE);
  const [formats, setFormats] = useState<readonly string[]>(concept?.formats ?? []);
  const [links, setLinks] = useState<readonly string[]>(() => linkRowsOf(concept));
  const [approvalStatus, setApprovalStatus] = useState(concept?.approvalStatus ?? NONE_VALUE);
  const [productionStatus, setProductionStatus] = useState(concept?.productionStatus ?? NONE_VALUE);
  const [formatsToCreate, setFormatsToCreate] = useState<readonly string[]>(
    concept?.formatsToCreate ?? [],
  );
  const [creatorId, setCreatorId] = useState(concept?.creatorId ?? NONE_VALUE);

  useEffect(() => {
    if (state !== null && state.ok) {
      if (creating) {
        router.push(conceptPath(state.id));
      } else {
        router.refresh();
      }
    }
  }, [state, creating, router]);

  const angle = angles.find((option) => option.id === angleId) ?? null;
  const theme = themes.find((option) => option.id === themeId) ?? null;

  const draft = useMemo(
    () => ({
      batch: batch === NONE_VALUE ? null : batch,
      angleName: angle?.name ?? null,
      themeName: theme?.name ?? null,
    }),
    [batch, angle, theme],
  );

  const validation = useMemo(
    () =>
      validateConceptDraft({
        batch: batch === NONE_VALUE ? null : batch,
        angleIds: angleId === NONE_VALUE ? [] : [angleId],
        themeIds: themeId === NONE_VALUE ? [] : [themeId],
        category: category === NONE_VALUE ? null : category,
        adInspoLinks: links,
      }),
    [batch, angleId, themeId, category, links],
  );

  const inherited = inheritedFromAngle(angle);

  /** The server's message for a field, if the last submission carried one. */
  const fieldError = (field: ConceptFieldName): string | undefined =>
    state !== null && !state.ok ? state.fieldErrors?.[field] : undefined;

  const blocked = demo || !validation.ok;
  const blockedHint = demo
    ? DEMO_WRITE_HINT
    : (Object.values(validation.fieldErrors)[0] ?? 'Nothing to save yet.');

  const toggleFormat = (key: AngleFormatKey) => {
    setFormats((current) =>
      current.includes(key) ? current.filter((entry) => entry !== key) : [...current, key],
    );
  };

  const toggleFormatToCreate = (key: string) => {
    setFormatsToCreate((current) =>
      current.includes(key) ? current.filter((entry) => entry !== key) : [...current, key],
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

  /**
   * One dropdown.
   *
   * `locked` is what demo mode does to it, and the three PAIRING dropdowns pass `false` on purpose:
   * Batch, Angle and Theme are the three parts of the generated name, and the live preview above
   * them is the whole subject of this page (PRD §7, ticket criterion 6). Moving them changes
   * nothing but the string in the browser — the save is still disabled, nothing is submitted and
   * nothing is stored — so a read-only visitor can see the formula work, which is the one thing the
   * demo deployment exists to show. The Brief's dropdowns below are locked like every other write:
   * drafting a brief that cannot be saved would be a lie, while previewing a name is not.
   */
  const renderSelect = (
    field: ConceptFieldName,
    label: string,
    options: readonly { key: string; label: string }[],
    value: string,
    set: (next: string) => void,
    locked: boolean,
  ) => {
    const id = `concept-field-${field}`;
    const error = fieldError(field);

    return (
      <div className="flex min-w-0 flex-col gap-1.5">
        <Label htmlFor={id} className="text-[11px] tracking-wide text-text3 uppercase">
          {label}
        </Label>
        <Select
          value={value === NONE_VALUE ? undefined : value}
          onValueChange={set}
          disabled={locked}
        >
          <SelectTrigger
            id={id}
            className="w-full"
            aria-label={label}
            aria-invalid={error !== undefined}
            data-slot={`concept-${field}`}
          >
            <SelectValue placeholder={NOT_SET} />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option.key} value={option.key}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {/* The stored value, including "nothing chosen": an empty string, which the action reads as NULL. */}
        <input type="hidden" name={field} value={value} />
        {error === undefined ? null : <p className="text-xs text-bad">{error}</p>}
      </div>
    );
  };

  const renderProse = (field: 'hookExamples' | 'scriptIdea', label: string, hint: string) => {
    const id = `concept-field-${field}`;
    const error = fieldError(field);

    return (
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={id} className="text-[11px] tracking-wide text-text3 uppercase">
          {label}
        </Label>
        <p className="text-xs text-text3">{hint}</p>
        <Textarea
          id={id}
          name={field}
          readOnly={demo}
          aria-invalid={error !== undefined}
          placeholder={NOT_SET}
          defaultValue={concept?.[field] ?? ''}
          data-slot={`concept-${field}`}
          className="min-h-24 leading-relaxed"
        />
        {error === undefined ? null : <p className="text-xs text-bad">{error}</p>}
      </div>
    );
  };

  const [pairing, inheritedGroup, brief] = CONCEPT_GROUPS;
  const linkError = fieldError('adInspoLinks');

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Link
          href={conceptsPath}
          data-slot="concept-back"
          className="self-start rounded-input text-xs text-text3 underline-offset-2 hover:text-text2 hover:underline"
        >
          ← All concepts
        </Link>
        <NamePreview draft={draft} />
      </div>

      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <form action={formAction} className="flex min-w-0 flex-col gap-7">
          {creating ? null : <input type="hidden" name="id" value={concept.id} />}
          {formats.map((key) => (
            <input key={key} type="hidden" name="formats" value={key} />
          ))}
          {formatsToCreate.map((key) => (
            <input key={`ftc-${key}`} type="hidden" name="formatsToCreate" value={key} />
          ))}
          <input type="hidden" name="approvalStatus" value={approvalStatus} />
          <input type="hidden" name="productionStatus" value={productionStatus} />
          <input type="hidden" name="creatorId" value={creatorId} />

          <section className="flex flex-col gap-3" data-slot="concept-pairing">
            <h2 className="flex items-center gap-2 border-b border-line pb-1 text-sm font-medium text-text2">
              {pairing?.heading}
            </h2>
            {pairing?.note === undefined ? null : (
              <p className="text-xs text-text3">{pairing.note}</p>
            )}
            {demo ? (
              <p className="text-xs text-text4" data-slot="concept-pairing-demo-note">
                These three stay live in demo mode so the name can be watched assembling itself.
                Nothing is saved.
              </p>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-3">
              {renderSelect(
                'batch',
                NAME_PART_LABELS.batch,
                BATCHES.map((key) => ({ key, label: key })),
                batch,
                setBatch,
                false,
              )}
              {renderSelect(
                'angleIds',
                NAME_PART_LABELS.angleName,
                angles.map((option) => ({ key: option.id, label: option.name })),
                angleId,
                setAngleId,
                false,
              )}
              {renderSelect(
                'themeIds',
                NAME_PART_LABELS.themeName,
                themes.map((option) => ({ key: option.id, label: option.name })),
                themeId,
                setThemeId,
                false,
              )}
            </div>
          </section>

          <section className="flex flex-col gap-3" data-slot="concept-inherited">
            <h2 className="flex items-center gap-2 border-b border-line pb-1 text-sm font-medium text-text2">
              {inheritedGroup?.heading}
            </h2>
            {inheritedGroup?.note === undefined ? null : (
              <p className="text-xs text-text3">{inheritedGroup.note}</p>
            )}
            <dl className="flex flex-col gap-4">
              {inherited.map((field) => (
                <div
                  key={field.key}
                  data-slot="inherited-field"
                  data-field={field.key}
                  className="flex min-w-0 flex-col gap-1"
                >
                  <dt className="flex flex-wrap items-baseline gap-2">
                    <span className="text-[11px] tracking-wide text-text3 uppercase">
                      {field.label}
                    </span>
                    <span
                      data-slot="from-angle"
                      className="font-mono text-[10.5px] tracking-wide text-text4"
                    >
                      {FROM_ANGLE}
                    </span>
                  </dt>
                  <dd
                    data-slot="inherited-value"
                    className={
                      field.value === null
                        ? 'text-sm text-text4'
                        : 'text-sm leading-relaxed break-words text-text2'
                    }
                  >
                    {field.value ?? EM_DASH}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="flex flex-col gap-4" data-slot="concept-brief">
            <div className="flex flex-col gap-1">
              <h2 className="flex items-center gap-2 border-b border-line pb-1 text-sm font-medium text-text2">
                {brief?.heading}
              </h2>
              {brief?.note === undefined ? null : (
                <p className="text-xs text-text3">{brief.note}</p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {renderSelect(
                'category',
                'Category',
                CONCEPT_CATEGORIES,
                category,
                setCategory,
                demo,
              )}
              {renderSelect(
                'conceptStyle',
                'Concept Style',
                CONCEPT_STYLES,
                conceptStyle,
                setConceptStyle,
                demo,
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {renderSelect(
                'approvalStatus',
                'Approval Status',
                CONCEPT_APPROVAL_STATUSES,
                approvalStatus,
                setApprovalStatus,
                demo,
              )}
              {renderSelect(
                'productionStatus',
                'Production Status',
                CONCEPT_PRODUCTION_STATUSES,
                productionStatus,
                setProductionStatus,
                demo,
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {renderSelect(
                'creatorId',
                'Creator',
                creators.map((option) => ({ key: option.id, label: option.name })),
                creatorId,
                setCreatorId,
                demo,
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-[11px] tracking-wide text-text3 uppercase">
                Formats to create (production)
              </Label>
              <DisabledWrite active={demo} hint={DEMO_WRITE_HINT} className="w-full">
                <div
                  className="flex flex-wrap gap-2"
                  role="group"
                  aria-label="Formats to create (production)"
                  data-slot="concept-formats-to-create"
                >
                  {ANGLE_FORMATS.map((entry) => {
                    const on = formatsToCreate.includes(entry.key);
                    return (
                      <button
                        key={entry.key}
                        type="button"
                        disabled={demo}
                        aria-pressed={on}
                        data-slot="format-to-create-toggle"
                        data-format={entry.key}
                        onClick={() => {
                          toggleFormatToCreate(entry.key);
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
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-[11px] tracking-wide text-text3 uppercase">
                Formats to create
              </Label>
              {/*
                Disabled in demo mode like every other write, so it is wrapped the same way: a
                disabled button receives no pointer events and could not carry its own tooltip.
                `disabledWriteClassName` is deliberately not applied — it flattens a control onto
                one muted surface, which on a toggle would erase which formats are selected, the one
                thing a read-only visitor came to see.
              */}
              <DisabledWrite active={demo} hint={DEMO_WRITE_HINT} className="w-full">
                <div
                  className="flex flex-wrap gap-2"
                  role="group"
                  aria-label="Formats to create"
                  data-slot="concept-formats"
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
            </div>

            {renderProse(
              'hookExamples',
              'Hook examples',
              'The first three seconds, written out. One per line.',
            )}
            {renderProse(
              'scriptIdea',
              'Script idea',
              'What happens on screen, in the order it happens.',
            )}

            <div className="flex flex-col gap-2" data-slot="concept-ad-inspo">
              <Label className="text-[11px] tracking-wide text-text3 uppercase">Ad Inspo</Label>
              {links.map((url, index) => (
                <div key={`row-${String(index)}`} className="flex items-center gap-2">
                  <Input
                    name="adInspoLinks"
                    value={url}
                    readOnly={demo}
                    aria-label={`Ad inspiration ${String(index + 1)}`}
                    placeholder="https://www.facebook.com/ads/library/?id=…"
                    data-slot="inspo-input"
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
              {links.filter((url) => url.trim() !== '' && isHttpUrl(url.trim())).length === 0 ? (
                <p className="text-xs text-text4" data-slot="concept-ad-inspo-empty">
                  No ad inspiration saved yet. Paste the full http(s) URL of a reference ad.
                </p>
              ) : null}
              {linkError === undefined ? null : <p className="text-xs text-bad">{linkError}</p>}
            </div>
          </section>

          <footer className="flex flex-wrap items-center justify-end gap-3 border-t border-line pt-4">
            {demo ? (
              <p className="mr-auto text-xs text-text3" data-slot="concept-demo-note">
                {DEMO_FOOTER_NOTICE}
              </p>
            ) : state !== null && !state.ok ? (
              <p className="mr-auto text-xs text-bad">{state.error}</p>
            ) : null}
            <DisabledWrite active={blocked} hint={blockedHint}>
              <Button
                type="submit"
                size="sm"
                disabled={blocked || pending}
                data-slot="concept-save"
                className={disabledWriteClassName}
              >
                {pending ? 'Saving…' : 'Save concept'}
              </Button>
            </DisabledWrite>
          </footer>
        </form>

        <aside data-slot="concept-rail" className="flex min-w-0 flex-col gap-3">
          <h2 className="text-sm font-medium text-text2">Approval</h2>
          <TwoTrackApproval track={track} internal={internal} client={client} clientOnly={false} />
        </aside>
      </div>
    </div>
  );
}
