'use client';

import { useActionState, useCallback, useEffect, useState } from 'react';
import type { EmailCampaignListRow } from '@tas/db';
import {
  Button,
  disabledWriteClassName,
  DisabledWrite,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  StatusChip,
  Textarea,
} from '@tas/ui';

import {
  createEmailCampaignAction,
  updateEmailCampaignAction,
  type EmailCampaignActionResult,
} from './actions';
import {
  CHANNEL_OPTIONS,
  EM_DASH,
  EMAIL_CAMPAIGN_FIELD_GROUPS,
  EMAIL_CAMPAIGN_LINK_FIELDS,
  NOT_SET,
  STATUS_OPTIONS,
  TYPE_OPTIONS,
  urlListText,
  type ChoiceOption,
  type EmailCampaignField,
  type EmailCampaignFieldName,
  type EmailCampaignLinkName,
} from './fields';

/** The `?emailCampaign=` value that means "the panel is open on a row that does not exist yet". */
export const NEW_EMAIL_CAMPAIGN = 'new';

/** What the demo footer says instead of offering a save. */
export const DEMO_FOOTER_NOTICE = 'Demo mode — changes are not saved';

/** One record of a linked table, as the chip pickers and the assignee Select list it. */
export interface EmailCampaignLinkOption {
  readonly id: string;
  readonly name: string;
}

interface EmailCampaignPanelProps {
  readonly emailCampaign: EmailCampaignListRow | null;
  readonly campaignOptions: readonly EmailCampaignLinkOption[];
  readonly productOptions: readonly EmailCampaignLinkOption[];
  readonly collectionOptions: readonly EmailCampaignLinkOption[];
  /** Team members, `id` being the Clerk user id `assignee_id` stores. */
  readonly assigneeOptions: readonly EmailCampaignLinkOption[];
  readonly demo: boolean;
  readonly onClose: () => void;
  readonly onSaved: (id: string) => void;
}

const NONE_VALUE = '';

/** The stored value of one field as the form's default; null and arrays become text. */
function valueOf(row: EmailCampaignListRow | null, field: EmailCampaignField): string {
  if (row === null) return '';
  const value = row[field.name];
  if (Array.isArray(value)) return urlListText(value);
  return typeof value === 'string' ? value : '';
}

function initialLinks(
  row: EmailCampaignListRow | null,
  name: EmailCampaignLinkName,
): readonly string[] {
  if (row === null) return [];
  return row[name];
}

const LABEL_CLASS = 'text-[11px] tracking-wide text-text3 uppercase';
const CHIP_ON =
  'rounded-input border border-accent-line bg-accent-soft px-2.5 py-1 font-mono text-[11px] tracking-wide text-accent uppercase disabled:cursor-not-allowed';
const CHIP_OFF =
  'rounded-input border border-line bg-surface2 px-2.5 py-1 font-mono text-[11px] tracking-wide text-text3 uppercase hover:border-line2 hover:text-text2 disabled:cursor-not-allowed';

/**
 * A single-select backed by a hidden input, so an unset value posts as `''` (stored NULL) and a
 * chosen one can be cleared again. The trigger carries the field id, so its Label addresses it.
 */
function ChoiceField({
  id,
  name,
  options,
  initial,
  demo,
  placeholder,
}: {
  id: string;
  name: string;
  options: readonly { id: string; name: string }[];
  initial: string;
  demo: boolean;
  placeholder: string;
}) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <input type="hidden" name={name} value={value} />
      <Select
        value={value === NONE_VALUE ? undefined : value}
        onValueChange={setValue}
        disabled={demo}
      >
        <SelectTrigger id={id} className="w-full" data-slot={`${id}-trigger`}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              {option.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {value !== NONE_VALUE && !demo ? (
        <button
          type="button"
          onClick={() => {
            setValue(NONE_VALUE);
          }}
          className="self-start rounded-input text-xs text-text3 underline-offset-2 hover:text-text2 hover:underline"
        >
          Clear
        </button>
      ) : null}
    </>
  );
}

function choiceOptions(options: readonly ChoiceOption[]): readonly { id: string; name: string }[] {
  return options.map((option) => ({ id: option.value, name: option.label }));
}

/**
 * The right-side email campaign panel. Not a modal: no backdrop, no focus trap, the grid beside it
 * stays clickable. Fixed to the right edge at 60% of the viewport, full width under 900px, closes on
 * Escape or its close button. Every stored field is editable in place; the two due dates are
 * read-only because they are the base's formulas, computed by the query layer; the three record
 * links are chip pickers posting repeated hidden inputs. In demo mode every control is read-only
 * and the footer says so instead of saving.
 */
export function EmailCampaignPanel({
  emailCampaign,
  campaignOptions,
  productOptions,
  collectionOptions,
  assigneeOptions,
  demo,
  onClose,
  onSaved,
}: EmailCampaignPanelProps) {
  const creating = emailCampaign === null;
  const action = creating ? createEmailCampaignAction : updateEmailCampaignAction;
  const [state, formAction, pending] = useActionState<EmailCampaignActionResult | null, FormData>(
    action,
    null,
  );
  const [links, setLinks] = useState<Record<EmailCampaignLinkName, readonly string[]>>(() => ({
    campaignOfferIds: initialLinks(emailCampaign, 'campaignOfferIds'),
    productIds: initialLinks(emailCampaign, 'productIds'),
    collectionIds: initialLinks(emailCampaign, 'collectionIds'),
  }));

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  useEffect(() => {
    if (state !== null && state.ok) onSaved(state.id);
  }, [state, onSaved]);

  const toggleLink = useCallback((name: EmailCampaignLinkName, id: string) => {
    setLinks((previous) => {
      const current = previous[name];
      const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
      return { ...previous, [name]: next };
    });
  }, []);

  const fieldError = (name: EmailCampaignFieldName): string | undefined =>
    state !== null && !state.ok ? state.fieldErrors?.[name] : undefined;

  const linkOptions = (name: EmailCampaignLinkName): readonly EmailCampaignLinkOption[] => {
    switch (name) {
      case 'campaignOfferIds':
        return campaignOptions;
      case 'productIds':
        return productOptions;
      case 'collectionIds':
        return collectionOptions;
    }
  };

  const renderControl = (field: EmailCampaignField, id: string, error: string | undefined) => {
    const common = {
      id,
      name: field.name,
      readOnly: demo,
      'aria-invalid': error !== undefined,
      placeholder: demo ? NOT_SET : field.placeholder,
      defaultValue: valueOf(emailCampaign, field),
    };
    switch (field.kind) {
      case 'textarea':
        return <Textarea {...common} className="min-h-28 leading-relaxed" />;
      case 'urlList':
        return <Textarea {...common} className="min-h-20 font-mono text-xs leading-relaxed" />;
      case 'url':
        return <Input {...common} type="url" className="font-mono text-xs" />;
      case 'date':
        return <Input {...common} type="date" className="font-mono text-xs" />;
      case 'text':
        return <Input {...common} type="text" />;
      case 'status':
        return (
          <ChoiceField
            id={id}
            name={field.name}
            options={choiceOptions(STATUS_OPTIONS)}
            initial={emailCampaign?.status ?? NONE_VALUE}
            demo={demo}
            placeholder={NOT_SET}
          />
        );
      case 'type':
        return (
          <ChoiceField
            id={id}
            name={field.name}
            options={choiceOptions(TYPE_OPTIONS)}
            initial={emailCampaign?.type ?? NONE_VALUE}
            demo={demo}
            placeholder={NOT_SET}
          />
        );
      case 'channel':
        return (
          <ChoiceField
            id={id}
            name={field.name}
            options={choiceOptions(CHANNEL_OPTIONS)}
            initial={emailCampaign?.channel ?? NONE_VALUE}
            demo={demo}
            placeholder={NOT_SET}
          />
        );
      case 'assignee':
        return (
          <ChoiceField
            id={id}
            name={field.name}
            options={assigneeOptions}
            initial={emailCampaign?.assigneeId ?? NONE_VALUE}
            demo={demo}
            placeholder={demo ? (emailCampaign?.assigneeName ?? NOT_SET) : 'Unassigned'}
          />
        );
    }
  };

  const renderField = (field: EmailCampaignField) => {
    const id = `email-campaign-field-${field.name}`;
    const error = fieldError(field.name);
    return (
      <div
        key={field.name}
        className="flex flex-col gap-1.5"
        data-slot="email-campaign-field"
        data-field={field.name}
      >
        <Label htmlFor={id} className={LABEL_CLASS}>
          {field.label}
          {field.required ? null : <span className="ml-1.5 text-text4 normal-case">optional</span>}
        </Label>
        {renderControl(field, id, error)}
        {error === undefined ? null : <p className="text-xs text-bad">{error}</p>}
      </div>
    );
  };

  return (
    <aside
      data-slot="email-campaign-panel"
      aria-label={creating ? 'New email campaign' : `Email campaign: ${emailCampaign.name}`}
      className="fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l border-line bg-surface shadow-lg min-[900px]:w-[60%]"
    >
      <header className="flex items-start justify-between gap-3 border-b border-line px-4 py-3 sm:px-6">
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="font-mono text-[11px] tracking-wide text-text3 uppercase">
            {creating ? 'New email campaign' : 'Email campaign'}
          </p>
          <h2
            className="truncate text-lg font-semibold text-text"
            data-slot="email-campaign-panel-title"
          >
            {creating ? 'New email campaign' : emailCampaign.name}
          </h2>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClose}
          aria-label="Close panel"
          data-slot="email-campaign-panel-close"
        >
          Close
        </Button>
      </header>

      <form action={formAction} className="flex min-h-0 flex-1 flex-col">
        {creating ? null : <input type="hidden" name="id" value={emailCampaign.id} />}
        {EMAIL_CAMPAIGN_LINK_FIELDS.flatMap((link) =>
          links[link.name].map((id) => (
            <input key={`${link.name}-${id}`} type="hidden" name={link.name} value={id} />
          )),
        )}

        <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          <div className="flex flex-col gap-7">
            {EMAIL_CAMPAIGN_FIELD_GROUPS.map((group) => (
              <section key={group.heading} className="flex flex-col gap-3">
                <h3
                  data-slot="email-campaign-group-heading"
                  className="border-b border-line pb-1 text-sm font-medium text-text2"
                >
                  {group.heading}
                </h3>
                <div className="flex flex-col gap-4">{group.fields.map(renderField)}</div>
              </section>
            ))}

            <section className="flex flex-col gap-3">
              <h3
                data-slot="email-campaign-group-heading"
                className="border-b border-line pb-1 text-sm font-medium text-text2"
              >
                Due dates
              </h3>
              <p className="text-xs text-text3">
                Computed from the send date: design five days before, copywriting ten. Read-only.
              </p>
              <dl className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <dt className={LABEL_CLASS}>Design Due Date</dt>
                  <dd className="font-mono text-sm text-text" data-slot="email-campaign-design-due">
                    {emailCampaign?.designDueDate ?? EM_DASH}
                  </dd>
                </div>
                <div className="flex flex-col gap-1.5">
                  <dt className={LABEL_CLASS}>Copywriting Due Date</dt>
                  <dd
                    className="font-mono text-sm text-text"
                    data-slot="email-campaign-copywriting-due"
                  >
                    {emailCampaign?.copywritingDueDate ?? EM_DASH}
                  </dd>
                </div>
              </dl>
            </section>

            <section className="flex flex-col gap-3">
              <h3
                data-slot="email-campaign-group-heading"
                className="border-b border-line pb-1 text-sm font-medium text-text2"
              >
                Links
              </h3>
              <div className="flex flex-col gap-4">
                {EMAIL_CAMPAIGN_LINK_FIELDS.map((link) => {
                  const labelId = `email-campaign-field-${link.name}-label`;
                  const options = linkOptions(link.name);
                  const selected = links[link.name];
                  return (
                    <div
                      key={link.name}
                      className="flex flex-col gap-1.5"
                      data-slot="email-campaign-field"
                      data-field={link.name}
                    >
                      <Label id={labelId} className={LABEL_CLASS}>
                        {link.label}
                        <span className="ml-1.5 text-text4 normal-case">optional</span>
                      </Label>
                      {options.length === 0 ? (
                        <p className="text-sm text-text3">{link.empty}</p>
                      ) : (
                        <div
                          role="group"
                          aria-labelledby={labelId}
                          className="flex flex-wrap gap-2"
                          data-slot={`${link.name}-picker`}
                        >
                          {options.map((option) => {
                            const on = selected.includes(option.id);
                            return (
                              <button
                                key={option.id}
                                type="button"
                                disabled={demo}
                                aria-pressed={on}
                                data-slot={`${link.name}-toggle`}
                                onClick={() => {
                                  toggleLink(link.name, option.id);
                                }}
                                className={on ? CHIP_ON : CHIP_OFF}
                              >
                                {option.name}
                              </button>
                            );
                          })}
                        </div>
                      )}
                      {demo && selected.length > 0 ? (
                        <span className="text-xs text-text3">
                          <StatusChip tone="info" label={`${String(selected.length)} linked`} />
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        </div>

        <footer className="sticky bottom-0 flex flex-wrap items-center justify-end gap-3 border-t border-line bg-surface2 px-4 py-3 sm:px-6">
          {demo ? (
            <p className="mr-auto text-xs text-text3" data-slot="email-campaign-demo-note">
              {DEMO_FOOTER_NOTICE}
            </p>
          ) : state !== null && !state.ok ? (
            <p className="mr-auto text-xs text-bad">{state.error}</p>
          ) : null}
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <DisabledWrite active={demo}>
            <Button
              type="submit"
              size="sm"
              disabled={demo || pending}
              data-slot="email-campaign-save"
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
