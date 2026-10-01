'use client';

import { useActionState, useCallback, useEffect, useState } from 'react';
import type { EmailFlowListRow } from '@tas/db';
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
  StatusChip,
  Textarea,
} from '@tas/ui';

import {
  createEmailFlowAction,
  updateEmailFlowAction,
  type EmailFlowActionResult,
} from './actions';
import {
  EM_DASH,
  EMAIL_FLOW_FIELD_GROUPS,
  EMAIL_FLOW_STATUS_OPTIONS,
  EMAIL_FLOW_TYPE_OPTIONS,
  formatDate,
  NOT_SET,
  statusLabel,
  statusTone,
  typeLabel,
  typeTone,
  urlListText,
  type EmailFlowField,
  type EmailFlowFieldName,
} from './fields';

/** The `?email-flow=` value that means "the panel is open on a flow that does not exist yet". */
export const NEW_EMAIL_FLOW = 'new';

/** What the demo footer says instead of offering a save. */
export const DEMO_FOOTER_NOTICE = 'Demo mode — changes are not saved';

/** The Select item that means "clear this field": Radix refuses an empty-string item value. */
const UNSET = '__unset__';

export interface LinkOption {
  readonly id: string;
  readonly name: string;
}

interface EmailFlowPanelProps {
  readonly flow: EmailFlowListRow | null;
  /** The brand's campaigns and offers, for the "Campaigns & Offers" chip picker. */
  readonly campaigns: readonly LinkOption[];
  /** The agency's team, `id` being the Clerk user id `assignee_id` stores. */
  readonly assignees: readonly LinkOption[];
  readonly demo: boolean;
  readonly onClose: () => void;
  readonly onSaved: (id: string) => void;
}

/** The stored value of one text-like field, as the form's default. */
function valueOf(flow: EmailFlowListRow | null, name: EmailFlowFieldName): string {
  if (flow === null) return '';
  const value = flow[name];
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return urlListText(value);
  return '';
}

const LABEL_CLASS = 'text-[11px] tracking-wide text-text3 uppercase';
const CHIP_ON =
  'rounded-input border border-accent-line bg-accent-soft px-2.5 py-1 font-mono text-[11px] tracking-wide text-accent uppercase disabled:cursor-not-allowed';
const CHIP_OFF =
  'rounded-input border border-line bg-surface2 px-2.5 py-1 font-mono text-[11px] tracking-wide text-text3 uppercase hover:border-line2 hover:text-text2 disabled:cursor-not-allowed';

/**
 * The right-side email flow panel. Deliberately not a modal: no backdrop, no focus trap, no
 * `aria-modal` — the grid beside it stays visible and clickable while this is open, which is the
 * point of a panel. It is fixed to the right edge at 60% of the viewport, full width under 900px,
 * and it closes on Escape or on its close button.
 *
 * Every one of the ten stored Airtable fields is editable in place and posts to the Server Actions;
 * the three single-selects post through hidden inputs, the two attachment fields as one URL per
 * line, and the "Campaigns & Offers" chip picker as repeated `campaignIds` hidden inputs. The two
 * base formulas (design due, copywriting due) are read-only: they arrive on the row from the query
 * layer and are recomputed on save, never here. In demo mode every control is read-only and the
 * footer says so instead of saving.
 */
export function EmailFlowPanel({
  flow,
  campaigns,
  assignees,
  demo,
  onClose,
  onSaved,
}: EmailFlowPanelProps) {
  const creating = flow === null;
  const action = creating ? createEmailFlowAction : updateEmailFlowAction;
  const [state, formAction, pending] = useActionState<EmailFlowActionResult | null, FormData>(
    action,
    null,
  );
  const [status, setStatus] = useState<string>(flow?.status ?? '');
  const [type, setType] = useState<string>(flow?.type ?? '');
  const [assigneeId, setAssigneeId] = useState<string>(flow?.assigneeId ?? '');
  const [campaignIds, setCampaignIds] = useState<readonly string[]>(flow?.campaignIds ?? []);

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

  const toggleCampaign = useCallback((id: string) => {
    setCampaignIds((previous) =>
      previous.includes(id) ? previous.filter((candidate) => candidate !== id) : [...previous, id],
    );
  }, []);

  const fieldError = (name: EmailFlowFieldName): string | undefined =>
    state !== null && !state.ok ? state.fieldErrors?.[name] : undefined;

  const renderSelect = (
    field: EmailFlowField,
    id: string,
    value: string,
    setValue: (next: string) => void,
    options: readonly { readonly value: string; readonly label: string }[],
  ) => (
    <>
      <Select
        value={value === '' ? UNSET : value}
        onValueChange={(next) => {
          setValue(next === UNSET ? '' : next);
        }}
        disabled={demo}
      >
        <SelectTrigger
          id={id}
          className="w-full"
          aria-label={field.label}
          data-slot={`email-flow-field-${field.name}`}
        >
          <SelectValue placeholder={NOT_SET} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={UNSET}>{NOT_SET}</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <input type="hidden" name={field.name} value={value} />
    </>
  );

  const renderField = (field: EmailFlowField) => {
    const id = `email-flow-field-${field.name}`;
    const error = fieldError(field.name);
    const shared = {
      id,
      name: field.name,
      readOnly: demo,
      'aria-invalid': error !== undefined,
      placeholder: demo ? NOT_SET : (field.placeholder ?? NOT_SET),
      defaultValue: valueOf(flow, field.name),
      'data-slot': id,
    };

    let control;
    switch (field.kind) {
      case 'status':
        control = renderSelect(field, id, status, setStatus, EMAIL_FLOW_STATUS_OPTIONS);
        break;
      case 'type':
        control = renderSelect(field, id, type, setType, EMAIL_FLOW_TYPE_OPTIONS);
        break;
      case 'assignee':
        control = renderSelect(
          field,
          id,
          assigneeId,
          setAssigneeId,
          assignees.map((person) => ({ value: person.id, label: person.name })),
        );
        break;
      case 'textarea':
        control = <Textarea {...shared} className="min-h-24 leading-relaxed" />;
        break;
      case 'urlList':
        control = <Textarea {...shared} className="min-h-20 font-mono text-xs leading-relaxed" />;
        break;
      case 'date':
        control = <Input {...shared} type="date" />;
        break;
      case 'url':
        control = <Input {...shared} type="url" className="font-mono text-xs" />;
        break;
      case 'input':
        control = <Input {...shared} />;
        break;
    }

    return (
      <div key={field.name} className="flex flex-col gap-1.5">
        <Label htmlFor={id} className={LABEL_CLASS}>
          {field.label}
          {field.required ? null : <span className="ml-1.5 text-text4 normal-case">optional</span>}
        </Label>
        {control}
        {field.hint === undefined ? null : <p className="text-xs text-text3">{field.hint}</p>}
        {error === undefined ? null : <p className="text-xs text-bad">{error}</p>}
      </div>
    );
  };

  return (
    <aside
      data-slot="email-flow-panel"
      aria-label={creating ? 'New email flow' : `Email flow: ${flow.flowName}`}
      className="fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l border-line bg-surface shadow-lg min-[900px]:w-[60%]"
    >
      <header className="flex items-start justify-between gap-3 border-b border-line px-4 py-3 sm:px-6">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="font-mono text-[11px] tracking-wide text-text3 uppercase">
            {creating ? 'New email flow' : 'Email flow'}
          </p>
          <h2
            className="truncate text-lg font-semibold text-text"
            data-slot="email-flow-panel-title"
          >
            {creating ? 'New email flow' : flow.flowName}
          </h2>
          {creating ? null : (
            <div className="flex flex-wrap items-center gap-1.5" data-slot="email-flow-panel-chips">
              {flow.status === null ? null : (
                <StatusChip tone={statusTone(flow.status)} label={statusLabel(flow.status)} />
              )}
              {flow.type === null ? null : (
                <StatusChip tone={typeTone(flow.type)} label={typeLabel(flow.type)} />
              )}
            </div>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClose}
          aria-label="Close panel"
          data-slot="email-flow-panel-close"
        >
          Close
        </Button>
      </header>

      <form action={formAction} className="flex min-h-0 flex-1 flex-col">
        {creating ? null : <input type="hidden" name="id" value={flow.id} />}
        {campaignIds.map((id) => (
          <input key={id} type="hidden" name="campaignIds" value={id} />
        ))}

        <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          <div className="flex flex-col gap-7">
            {EMAIL_FLOW_FIELD_GROUPS.map((group) => (
              <section key={group.heading} className="flex flex-col gap-3">
                <h3
                  data-slot="email-flow-group-heading"
                  className="border-b border-line pb-1 text-sm font-medium text-text2"
                >
                  {group.heading}
                </h3>
                <div className="flex flex-col gap-4">
                  {group.fields.map(renderField)}
                  {group.heading === 'Schedule' && !creating ? (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="flex flex-col gap-1.5">
                        <span className={LABEL_CLASS}>Design Due Date</span>
                        <span
                          className="font-mono text-sm text-text"
                          data-slot="email-flow-design-due"
                        >
                          {formatDate(flow.designDueDate)}
                        </span>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <span className={LABEL_CLASS}>Copywriting Due Date</span>
                        <span
                          className="font-mono text-sm text-text"
                          data-slot="email-flow-copywriting-due"
                        >
                          {formatDate(flow.copywritingDueDate)}
                        </span>
                      </div>
                      <p className="text-xs text-text3 sm:col-span-2">
                        Computed from the expected setup date. Read-only; recalculated on save.
                      </p>
                    </div>
                  ) : null}
                </div>
              </section>
            ))}

            <section className="flex flex-col gap-3">
              <h3
                data-slot="email-flow-group-heading"
                className="border-b border-line pb-1 text-sm font-medium text-text2"
              >
                Campaigns &amp; Offers
              </h3>
              {campaigns.length === 0 ? (
                <p className="text-sm text-text3">No campaigns in this brand yet.</p>
              ) : (
                <div className="flex flex-wrap gap-2" data-slot="email-flow-campaign-picker">
                  {campaigns.map((campaign) => {
                    const on = campaignIds.includes(campaign.id);
                    return (
                      <button
                        key={campaign.id}
                        type="button"
                        disabled={demo}
                        aria-pressed={on}
                        data-slot="email-flow-campaign-toggle"
                        onClick={() => {
                          toggleCampaign(campaign.id);
                        }}
                        className={on ? CHIP_ON : CHIP_OFF}
                      >
                        {campaign.name}
                      </button>
                    );
                  })}
                </div>
              )}
              <p className="text-xs text-text3">
                {campaignIds.length === 0
                  ? `No campaign linked ${EM_DASH} pick the offers this flow carries.`
                  : `${String(campaignIds.length)} linked.`}
              </p>
            </section>
          </div>
        </div>

        <footer className="sticky bottom-0 flex flex-wrap items-center justify-end gap-3 border-t border-line bg-surface2 px-4 py-3 sm:px-6">
          {demo ? (
            <p className="mr-auto text-xs text-text3" data-slot="email-flow-demo-note">
              {DEMO_FOOTER_NOTICE}
            </p>
          ) : state !== null && !state.ok ? (
            <p className="mr-auto text-xs text-bad">{state.error}</p>
          ) : null}
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <DisabledWrite active={demo} hint={DEMO_WRITE_HINT}>
            <Button
              type="submit"
              size="sm"
              disabled={demo || pending}
              data-slot="email-flow-save"
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
