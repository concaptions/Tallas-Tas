'use client';

import { useActionState, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
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

import { updateCreatorAction, type CreatorActionResult } from './actions';
import {
  clientStatusChoices,
  collabDateLabel,
  collabStats,
  CONTINUE_WORKING_WITH,
  continueWorkingWithKey,
  dateInputValue,
  internalStatusChoices,
  isoDateLabel,
  partnershipActivityChip,
  statusChoice,
  type CollabRow,
  type CreatorCardRow,
  type StatusChoice,
} from './fields';

export interface LinkOption {
  readonly id: string;
  readonly name: string;
}

interface CreatorPanelProps {
  readonly creator: CreatorCardRow;
  readonly concepts: readonly LinkOption[];
  readonly products: readonly LinkOption[];
  readonly collabs: readonly CollabRow[];
  readonly demo: boolean;
  readonly onClose: () => void;
  readonly onSaved: (id: string) => void;
}

const AGE_BRACKETS = ['18-24', '25-34', '35-44', '45-54', '55+'] as const;
const PLATFORMS = ['instagram', 'tiktok', 'youtube', 'facebook', 'twitter'] as const;

export function CreatorPanel({
  creator,
  concepts,
  products,
  collabs,
  demo,
  onClose,
  onSaved,
}: CreatorPanelProps) {
  const [state, formAction, pending] = useActionState<CreatorActionResult | null, FormData>(
    updateCreatorAction,
    null,
  );

  const [name, setName] = useState(creator.name);
  // Controlled, unlike the other Selects, because the chip beside each one follows the choice.
  const [internalStatus, setInternalStatus] = useState(creator.internalCreatorStatus);
  const [clientStatus, setClientStatus] = useState(creator.clientStatus);
  const [selectedConceptIds, setSelectedConceptIds] = useState<readonly string[]>(
    creator.conceptIds,
  );
  const [selectedProductIds, setSelectedProductIds] = useState<readonly string[]>(
    creator.productIds,
  );

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

  const toggleConcept = useCallback((id: string) => {
    setSelectedConceptIds((prev) =>
      prev.includes(id) ? prev.filter((cid) => cid !== id) : [...prev, id],
    );
  }, []);

  const toggleProduct = useCallback((id: string) => {
    setSelectedProductIds((prev) =>
      prev.includes(id) ? prev.filter((pid) => pid !== id) : [...prev, id],
    );
  }, []);

  const stats = useMemo(() => collabStats(collabs), [collabs]);
  const internalChoices = useMemo(
    () => internalStatusChoices(creator.internalCreatorStatus),
    [creator.internalCreatorStatus],
  );
  const clientChoices = useMemo(
    () => clientStatusChoices(creator.clientStatus),
    [creator.clientStatus],
  );
  const activity = partnershipActivityChip(creator.partnershipActivity);

  const blocked = demo || name.trim() === '';
  const blockedHint = demo ? DEMO_WRITE_HINT : 'Name is required.';

  const textField = (
    fieldName: string,
    label: string,
    defaultValue: string | null | undefined,
    opts?: { type?: string; readOnly?: boolean; mono?: boolean },
  ) => {
    const id = `creator-field-${fieldName}`;
    return (
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={id} className="text-[11px] tracking-wide text-text3 uppercase">
          {label}
        </Label>
        <Input
          id={id}
          name={fieldName}
          type={opts?.type ?? 'text'}
          readOnly={demo || opts?.readOnly === true}
          defaultValue={defaultValue ?? ''}
          className={opts?.mono === true ? 'font-mono text-xs' : undefined}
        />
      </div>
    );
  };

  /** Whole USD or whole days: the cost-input pattern, `min=0 step=1`, in `font-mono`. */
  const numberField = (
    fieldName: string,
    label: string,
    defaultValue: number | null | undefined,
  ) => {
    const id = `creator-field-${fieldName}`;
    return (
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={id} className="text-[11px] tracking-wide text-text3 uppercase">
          {label}
        </Label>
        <Input
          id={id}
          name={fieldName}
          type="number"
          min={0}
          step={1}
          readOnly={demo}
          defaultValue={defaultValue ?? ''}
          className="font-mono"
        />
      </div>
    );
  };

  const textareaField = (
    fieldName: string,
    label: string,
    defaultValue: string | null | undefined,
  ) => {
    const id = `creator-field-${fieldName}`;
    return (
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={id} className="text-[11px] tracking-wide text-text3 uppercase">
          {label}
        </Label>
        <Textarea
          id={id}
          name={fieldName}
          readOnly={demo}
          defaultValue={defaultValue ?? ''}
          className="min-h-24 leading-relaxed"
        />
      </div>
    );
  };

  /** A status track: the Select over the domain's choices, the `StatusChip` of the current one beside it. */
  const statusField = (
    fieldName: string,
    label: string,
    value: string,
    onChange: (next: string) => void,
    choices: readonly StatusChoice[],
  ) => {
    const id = `creator-field-${fieldName}`;
    const chip = statusChoice(choices, value);
    return (
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={id} className="text-[11px] tracking-wide text-text3 uppercase">
          {label}
        </Label>
        <div className="flex items-center gap-2">
          <Select value={value} onValueChange={onChange} name={fieldName} disabled={demo}>
            <SelectTrigger id={id} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {choices.map((choice) => (
                <SelectItem key={choice.key} value={choice.key}>
                  {choice.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <StatusChip tone={chip.tone} label={chip.label} />
        </div>
      </div>
    );
  };

  /** A value the scanner owns: labelled like a field, rendered as text, never posted. */
  const readOnlyField = (slot: string, label: string, value: ReactNode, hint: string) => (
    <div className="flex flex-col gap-1.5" data-slot={`creator-field-${slot}`}>
      <span className="text-[11px] tracking-wide text-text3 uppercase">{label}</span>
      <div className="flex items-center">{value}</div>
      <p className="text-xs text-text3">{hint}</p>
    </div>
  );

  return (
    <aside
      data-slot="creator-panel"
      aria-label={`Creator: ${creator.name}`}
      className="fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l border-line bg-surface shadow-lg min-[900px]:w-[60%]"
    >
      <header className="flex items-start justify-between gap-3 border-b border-line px-4 py-3 sm:px-6">
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="font-mono text-[11px] tracking-wide text-text3 uppercase">Creator</p>
          <h2 className="truncate text-lg font-semibold text-text" data-slot="creator-panel-title">
            {creator.name}
          </h2>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClose}
          aria-label="Close panel"
          data-slot="creator-panel-close"
        >
          Close
        </Button>
      </header>

      {collabs.length > 0 ? (
        <div
          className="flex flex-wrap gap-4 border-b border-line px-4 py-2.5 sm:px-6"
          data-slot="creator-stats"
        >
          <div className="flex flex-col">
            <span className="text-[11px] tracking-wide text-text3 uppercase">Collaborations</span>
            <span className="font-mono text-sm font-semibold text-text">{stats.totalCollabs}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[11px] tracking-wide text-text3 uppercase">Active</span>
            <span className="font-mono text-sm font-semibold text-text">{stats.activeCollabs}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[11px] tracking-wide text-text3 uppercase">Total Paid</span>
            <span className="font-mono text-sm font-semibold text-text">
              {stats.totalPaid > 0 ? `$${String(stats.totalPaid)}` : '$0'}
            </span>
          </div>
        </div>
      ) : null}

      <form action={formAction} className="flex min-h-0 flex-1 flex-col">
        <input type="hidden" name="id" value={creator.id} />
        {selectedConceptIds.map((cid) => (
          <input key={cid} type="hidden" name="conceptIds" value={cid} />
        ))}
        {selectedProductIds.map((pid) => (
          <input key={pid} type="hidden" name="productIds" value={pid} />
        ))}

        <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          <div className="flex flex-col gap-7">
            <section className="flex flex-col gap-3">
              <h3 className="flex items-center gap-2 border-b border-line pb-1 text-sm font-medium text-text2">
                Identity
              </h3>
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label
                    htmlFor="creator-field-name"
                    className="text-[11px] tracking-wide text-text3 uppercase"
                  >
                    Name
                  </Label>
                  <Input
                    id="creator-field-name"
                    name="name"
                    readOnly={demo}
                    value={name}
                    onChange={(event) => {
                      setName(event.target.value);
                    }}
                  />
                </div>
                {textField('gender', 'Gender', creator.gender)}
                {textField('ethnicity', 'Ethnicity', creator.ethnicity)}

                <div className="flex flex-col gap-1.5">
                  <Label
                    htmlFor="creator-field-ageBracket"
                    className="text-[11px] tracking-wide text-text3 uppercase"
                  >
                    Age Bracket
                  </Label>
                  <Select
                    defaultValue={creator.ageBracket ?? undefined}
                    name="ageBracket"
                    disabled={demo}
                  >
                    <SelectTrigger id="creator-field-ageBracket" className="w-full">
                      <SelectValue placeholder="Not set" />
                    </SelectTrigger>
                    <SelectContent>
                      {AGE_BRACKETS.map((bracket) => (
                        <SelectItem key={bracket} value={bracket}>
                          {bracket}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label
                    htmlFor="creator-field-platform"
                    className="text-[11px] tracking-wide text-text3 uppercase"
                  >
                    Platform
                  </Label>
                  <Select
                    defaultValue={creator.platform[0] ?? undefined}
                    name="platform"
                    disabled={demo}
                  >
                    <SelectTrigger id="creator-field-platform" className="w-full">
                      <SelectValue placeholder="Not set" />
                    </SelectTrigger>
                    <SelectContent>
                      {PLATFORMS.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p.charAt(0).toUpperCase() + p.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {textField('profilePicUrl', 'Profile Picture', creator.profilePicUrl, {
                  type: 'url',
                  mono: true,
                })}
                {textField('videoIntroUrl', 'Video Intro', creator.videoIntroUrl, {
                  type: 'url',
                  mono: true,
                })}
              </div>
            </section>

            {/* The one track the client interface renders (CLAUDE.md non-negotiable 10), and the note they wrote back. */}
            <section className="flex flex-col gap-3" data-slot="creator-client-section">
              <h3 className="flex items-center gap-2 border-b border-line pb-1 text-sm font-medium text-text2">
                Client Review
              </h3>
              <div className="flex flex-col gap-4">
                {statusField(
                  'clientStatus',
                  'Client Status',
                  clientStatus,
                  setClientStatus,
                  clientChoices,
                )}
                {textareaField('clientNote', "Client's Note", creator.clientNote)}
              </div>
            </section>

            <section className="flex flex-col gap-3">
              <h3 className="flex items-center gap-2 border-b border-line pb-1 text-sm font-medium text-text2">
                Details
              </h3>
              <div className="flex flex-col gap-4">
                {textField('creatorLink', 'Creator Link', creator.creatorLink, {
                  type: 'url',
                  mono: true,
                })}
                {textField('shippingLocation', 'Shipping Location', creator.shippingLocation)}
                {textField('trackingNumber', 'Tracking Number', creator.trackingNumber, {
                  mono: true,
                })}
                {textField('rawAssetsUrl', 'Raw Assets URL', creator.rawAssetsUrl, {
                  type: 'url',
                  mono: true,
                })}
                {textareaField('internalBrief', 'Internal Brief', creator.internalBrief)}
              </div>
            </section>

            {/* PRD §5.8.1's whitelisting fields, on the same record. The activity and its activation date are the scanner's. */}
            <section className="flex flex-col gap-3" data-slot="creator-partnership-section">
              <h3 className="flex items-center gap-2 border-b border-line pb-1 text-sm font-medium text-text2">
                Partnership Ads
              </h3>
              <div className="flex flex-col gap-4">
                {textField('instagramUsername', 'Instagram Username', creator.instagramUsername, {
                  mono: true,
                })}
                {textField('facebookProfileUrl', 'Facebook Profile', creator.facebookProfileUrl, {
                  type: 'url',
                  mono: true,
                })}
                {readOnlyField(
                  'partnershipActivity',
                  'Partnership Activity',
                  <StatusChip tone={activity.tone} label={activity.label} />,
                  'Set by the partnership scanner; read-only here.',
                )}
                {readOnlyField(
                  'partnershipActivatedAt',
                  'Date of Partnership Activation',
                  <span className="font-mono text-sm text-text2">
                    {isoDateLabel(creator.partnershipActivatedAt ?? null)}
                  </span>,
                  'Stamped when the whitelisting window opens; read-only here.',
                )}
                {numberField(
                  'partnershipPeriodDays',
                  'Partnership Time Period (days)',
                  creator.partnershipPeriodDays,
                )}
                {numberField('extensionDays', 'Extension Time Period', creator.extensionDays)}
                <div className="flex flex-col gap-1.5">
                  <Label
                    htmlFor="creator-field-continueWorkingWith"
                    className="text-[11px] tracking-wide text-text3 uppercase"
                  >
                    Continue Working With?
                  </Label>
                  <Select
                    defaultValue={continueWorkingWithKey(creator.continueWorkingWith ?? null)}
                    name="continueWorkingWith"
                    disabled={demo}
                  >
                    <SelectTrigger id="creator-field-continueWorkingWith" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CONTINUE_WORKING_WITH.map((option) => (
                        <SelectItem key={option.key} value={option.key}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </section>

            <section className="flex flex-col gap-3">
              <h3 className="flex items-center gap-2 border-b border-line pb-1 text-sm font-medium text-text2">
                Costs (internal only)
              </h3>
              <p className="text-xs text-text3">Never shown to clients. Whole USD, no cents.</p>
              <div className="flex flex-col gap-4">
                {/* `creator_cost` (what the creator charges) and `cost_usd` (what TAS paid) are two columns, two fields. */}
                {numberField('creatorCost', 'Creator Cost (USD)', creator.creatorCost)}
                {numberField('costUsd', 'Paid by TAS (USD)', creator.costUsd)}
                {numberField('budgetPer60s', 'Budget per 60sec Video', creator.budgetPer60s)}
                {numberField(
                  'partnershipPricePer30Days',
                  'Partnership Price / 30 Days (USD)',
                  creator.partnershipPricePer30Days,
                )}
                {textField('paymentDate', 'Payment Date', dateInputValue(creator.paymentDate), {
                  type: 'date',
                  mono: true,
                })}
              </div>
            </section>

            <section className="flex flex-col gap-3" data-slot="creator-management-section">
              <h3 className="flex items-center gap-2 border-b border-line pb-1 text-sm font-medium text-text2">
                Management (internal only)
              </h3>
              <p className="text-xs text-text3">Never shown to clients.</p>
              <div className="flex flex-col gap-4">
                {statusField(
                  'internalCreatorStatus',
                  'Internal Status',
                  internalStatus,
                  setInternalStatus,
                  internalChoices,
                )}
                {textField(
                  'dateOfManagement',
                  'Date of Management',
                  dateInputValue(creator.dateOfManagement ?? null),
                  { type: 'date', mono: true },
                )}
                {textareaField(
                  'creatorInfoRequest',
                  'Creator Info Request',
                  creator.creatorInfoRequest,
                )}
                {textareaField(
                  'partnershipNotes',
                  'Notes for Partnership Ads',
                  creator.partnershipNotes,
                )}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-3" data-slot="creator-field-slackNotified">
                    <input
                      id="creator-field-slackNotified"
                      type="checkbox"
                      checked={creator.slackNotified}
                      readOnly
                      disabled
                      className="size-4 shrink-0 rounded-input border border-line2 bg-surface2 accent-[var(--accent)] disabled:cursor-not-allowed"
                    />
                    <Label
                      htmlFor="creator-field-slackNotified"
                      className="text-[11px] tracking-wide text-text3 uppercase"
                    >
                      Slack Notified
                    </Label>
                  </div>
                  <p className="text-xs text-text3">
                    Set by the partnership reminder automation; read-only here.
                  </p>
                </div>
              </div>
            </section>

            <section className="flex flex-col gap-3">
              <h3 className="flex items-center gap-2 border-b border-line pb-1 text-sm font-medium text-text2">
                Linked Concepts
              </h3>
              {concepts.length === 0 ? (
                <p className="text-sm text-text3">No concepts in this brand yet.</p>
              ) : (
                <div className="flex flex-wrap gap-2" data-slot="concept-picker">
                  {concepts.map((concept) => {
                    const on = selectedConceptIds.includes(concept.id);
                    return (
                      <button
                        key={concept.id}
                        type="button"
                        disabled={demo}
                        aria-pressed={on}
                        data-slot="concept-toggle"
                        onClick={() => {
                          toggleConcept(concept.id);
                        }}
                        className={
                          on
                            ? 'rounded-input border border-accent-line bg-accent-soft px-2.5 py-1 font-mono text-[11px] tracking-wide text-accent uppercase disabled:cursor-not-allowed'
                            : 'rounded-input border border-line bg-surface2 px-2.5 py-1 font-mono text-[11px] tracking-wide text-text3 uppercase hover:border-line2 hover:text-text2 disabled:cursor-not-allowed'
                        }
                      >
                        {concept.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="flex flex-col gap-3">
              <h3 className="flex items-center gap-2 border-b border-line pb-1 text-sm font-medium text-text2">
                Linked Products
              </h3>
              {products.length === 0 ? (
                <p className="text-sm text-text3">No products in this brand yet.</p>
              ) : (
                <div className="flex flex-wrap gap-2" data-slot="product-picker">
                  {products.map((product) => {
                    const on = selectedProductIds.includes(product.id);
                    return (
                      <button
                        key={product.id}
                        type="button"
                        disabled={demo}
                        aria-pressed={on}
                        data-slot="product-toggle"
                        onClick={() => {
                          toggleProduct(product.id);
                        }}
                        className={
                          on
                            ? 'rounded-input border border-accent-line bg-accent-soft px-2.5 py-1 font-mono text-[11px] tracking-wide text-accent uppercase disabled:cursor-not-allowed'
                            : 'rounded-input border border-line bg-surface2 px-2.5 py-1 font-mono text-[11px] tracking-wide text-text3 uppercase hover:border-line2 hover:text-text2 disabled:cursor-not-allowed'
                        }
                      >
                        {product.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="flex flex-col gap-3" data-slot="collaborations-section">
              <h3 className="flex items-center gap-2 border-b border-line pb-1 text-sm font-medium text-text2">
                Past Collaborations
                {collabs.length > 0 ? (
                  <span className="text-xs font-normal text-text3">({collabs.length})</span>
                ) : null}
              </h3>
              {collabs.length === 0 ? (
                <p className="text-sm text-text3">No collaborations yet.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {collabs.map((collab) => (
                    <div
                      key={collab.id}
                      className="flex flex-col gap-1 rounded-card border border-line bg-surface2 px-3 py-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs text-text2">
                          {collabDateLabel(collab)}
                        </span>
                        {collab.costUsd !== null ? (
                          <span className="font-mono text-xs font-semibold text-text">
                            ${String(collab.costUsd)}
                          </span>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <span className="rounded-input bg-surface px-1.5 py-0.5 text-[10px] tracking-wide text-text3 uppercase">
                          Int: {collab.internalStatus.replaceAll('_', ' ')}
                        </span>
                        <span className="rounded-input bg-surface px-1.5 py-0.5 text-[10px] tracking-wide text-text3 uppercase">
                          Client: {collab.clientStatus.replaceAll('_', ' ')}
                        </span>
                        <span className="rounded-input bg-surface px-1.5 py-0.5 text-[10px] tracking-wide text-text3 uppercase">
                          Assets: {collab.assetsStatus.replaceAll('_', ' ')}
                        </span>
                      </div>
                      {collab.notes !== null && collab.notes.trim() !== '' ? (
                        <p className="text-xs leading-relaxed text-text3">{collab.notes}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>

        <footer className="sticky bottom-0 flex flex-wrap items-center justify-end gap-3 border-t border-line bg-surface2 px-4 py-3 sm:px-6">
          {demo ? (
            <p className="mr-auto text-xs text-text3" data-slot="creator-demo-note">
              Demo mode — changes are not saved
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
              data-slot="creator-save"
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
