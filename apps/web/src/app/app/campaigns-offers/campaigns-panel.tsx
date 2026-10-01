'use client';

import { useActionState, useEffect, useState } from 'react';
import Link from 'next/link';
import type { CampaignOffer } from '@tas/db';
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
  StatusChip,
} from '@tas/ui';

import {
  createCampaignAction,
  updateCampaignAction,
  type CampaignActionResult,
  type CampaignFieldName,
} from './actions';
import { CAMPAIGN_FIELD_GROUPS, NOT_SET, type LinkedRecord } from './fields';

export const NEW_CAMPAIGN = 'new';
const DEMO_FOOTER_NOTICE = 'Demo mode — changes are not saved';
const NONE_VALUE = '';

export interface LinkOption {
  readonly id: string;
  readonly name: string;
}

interface CampaignPanelProps {
  readonly campaign: CampaignOffer | null;
  readonly products: readonly LinkOption[];
  /** Names of the collections whose `campaign_id` points here; the link is edited on their side. */
  readonly linkedCollections: readonly string[];
  /** Email campaigns linked here through `email_campaign_campaigns`; edited on their side. */
  readonly linkedEmailCampaigns: readonly LinkedRecord[];
  /** Email flows linked here through `email_flow_campaigns`; edited on their side. */
  readonly linkedEmailFlows: readonly LinkedRecord[];
  /** YouTube copy carrying this campaign code (`youtube_copy_campaigns`); edited on its side. */
  readonly linkedYoutubeCopy: readonly LinkedRecord[];
  readonly linkedMetaCopy: readonly LinkedRecord[];
  readonly linkedConcepts: readonly LinkedRecord[];
  readonly demo: boolean;
  readonly onClose: () => void;
  readonly onSaved: (id: string) => void;
}

interface LinkedRecordsSectionProps {
  readonly heading: string;
  /** The `data-slot` of the list, stable whether it holds links or the empty sentence. */
  readonly slot: string;
  readonly links: readonly LinkedRecord[];
  /** What the section says when nothing links here, naming where the link IS edited. */
  readonly empty: string;
  /** The labels are generated titles (`Copy 3 · …`), which the design system sets in `font-mono`. */
  readonly mono?: boolean;
}

/**
 * One read-only list of records that point at this campaign from their own panel: a link into the
 * other module's page per row, with its status chip when the row carries one. The shape of the
 * "Linked angles" list on the product and persona panels, with a link in place of a plain chip.
 */
function LinkedRecordsSection({
  heading,
  slot,
  links,
  empty,
  mono = false,
}: LinkedRecordsSectionProps) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="border-b border-line pb-1 text-sm font-medium text-text2">{heading}</h3>
      <div className="flex flex-col gap-2" data-slot={slot}>
        {links.length === 0 ? (
          <span className="text-xs text-text3">{empty}</span>
        ) : (
          <ul className="flex flex-col gap-2">
            {links.map((link) => (
              <li
                key={link.id}
                data-slot="campaign-linked-record"
                data-linked-id={link.id}
                className="flex flex-wrap items-center gap-2"
              >
                {link.href === undefined ? (
                  <span className={mono ? 'font-mono text-xs text-text' : 'text-sm text-text'}>
                    {link.label}
                  </span>
                ) : (
                  <Link
                    href={link.href}
                    className={`${mono ? 'font-mono text-xs' : 'text-sm'} rounded-input text-text underline-offset-2 hover:text-accent hover:underline`}
                  >
                    {link.label}
                  </Link>
                )}
                {link.chip === undefined ? null : (
                  <StatusChip tone={link.chip.tone} label={link.chip.label} />
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function valueOf(campaign: CampaignOffer | null, name: CampaignFieldName): string {
  if (campaign === null) return '';
  const value = campaign[name as keyof CampaignOffer];
  if (typeof value === 'string') return value;
  if (typeof value === 'boolean') return '';
  return '';
}

function boolOf(campaign: CampaignOffer | null, name: 'confirmedByClient' | 'launched'): boolean {
  if (campaign === null) return false;
  return campaign[name];
}

export function CampaignPanel({
  campaign,
  products,
  linkedCollections,
  linkedEmailCampaigns,
  linkedEmailFlows,
  linkedYoutubeCopy,
  linkedMetaCopy,
  linkedConcepts,
  demo,
  onClose,
  onSaved,
}: CampaignPanelProps) {
  const creating = campaign === null;
  const action = creating ? createCampaignAction : updateCampaignAction;
  const [state, formAction, pending] = useActionState<CampaignActionResult | null, FormData>(
    action,
    null,
  );

  const [productId, setProductId] = useState(campaign?.productId ?? NONE_VALUE);
  const [confirmedByClient, setConfirmedByClient] = useState(boolOf(campaign, 'confirmedByClient'));
  const [launched, setLaunched] = useState(boolOf(campaign, 'launched'));

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

  const fieldError = (field: CampaignFieldName): string | undefined => {
    if (state !== null && !state.ok && state.fieldErrors?.[field] !== undefined) {
      return state.fieldErrors[field];
    }
    return undefined;
  };

  const blocked = demo;
  const blockedHint = demo ? DEMO_WRITE_HINT : 'Nothing to save yet.';

  return (
    <aside
      data-slot="campaign-panel"
      aria-label={creating ? 'New campaign' : `Campaign: ${campaign.name}`}
      className="fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l border-line bg-surface shadow-lg min-[900px]:w-[60%]"
    >
      <header className="flex items-start justify-between gap-3 border-b border-line px-4 py-3 sm:px-6">
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="font-mono text-[11px] tracking-wide text-text3 uppercase">
            {creating ? 'New campaign' : 'Campaign'}
          </p>
          <h2 className="truncate text-lg font-semibold text-text" data-slot="campaign-panel-title">
            {creating ? 'New campaign' : campaign.name}
          </h2>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClose}
          aria-label="Close panel"
          data-slot="campaign-panel-close"
        >
          Close
        </Button>
      </header>

      <form action={formAction} className="flex min-h-0 flex-1 flex-col">
        {creating ? null : <input type="hidden" name="id" value={campaign.id} />}
        <input type="hidden" name="confirmedByClient" value={confirmedByClient ? 'true' : ''} />
        <input type="hidden" name="launched" value={launched ? 'true' : ''} />
        <input type="hidden" name="productId" value={productId} />

        <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          <div className="flex flex-col gap-7">
            {CAMPAIGN_FIELD_GROUPS.map((group) => (
              <section key={group.heading} className="flex flex-col gap-3">
                <h3
                  data-slot="campaign-group-heading"
                  className="flex items-center gap-2 border-b border-line pb-1 text-sm font-medium text-text2"
                >
                  {group.heading}
                </h3>
                <div className="flex flex-col gap-4">
                  {group.fields.map((field) => {
                    if (field.type === 'checkbox') {
                      const checked =
                        field.name === 'confirmedByClient' ? confirmedByClient : launched;
                      const toggle =
                        field.name === 'confirmedByClient' ? setConfirmedByClient : setLaunched;
                      return (
                        <div key={field.name} className="flex items-center gap-3">
                          <input
                            id={`campaign-field-${field.name}`}
                            type="checkbox"
                            checked={checked}
                            disabled={demo}
                            onChange={(e) => {
                              toggle(e.target.checked);
                            }}
                            className="h-4 w-4 rounded border-line text-accent"
                          />
                          <Label
                            htmlFor={`campaign-field-${field.name}`}
                            className="text-[11px] tracking-wide text-text3 uppercase"
                          >
                            {field.label}
                          </Label>
                        </div>
                      );
                    }

                    if (field.type === 'select' && field.name === 'productId') {
                      return (
                        <div key={field.name} className="flex flex-col gap-1.5">
                          <Label
                            htmlFor="campaign-field-productId"
                            className="text-[11px] tracking-wide text-text3 uppercase"
                          >
                            {field.label}
                          </Label>
                          <Select
                            value={productId === NONE_VALUE ? undefined : productId}
                            onValueChange={setProductId}
                            disabled={demo}
                          >
                            <SelectTrigger
                              id="campaign-field-productId"
                              className="w-full"
                              aria-label="Product"
                              data-slot="campaign-productId"
                            >
                              <SelectValue placeholder="None" />
                            </SelectTrigger>
                            <SelectContent>
                              {products.map((option) => (
                                <SelectItem key={option.id} value={option.id}>
                                  {option.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {productId !== NONE_VALUE && !demo ? (
                            <button
                              type="button"
                              onClick={() => {
                                setProductId(NONE_VALUE);
                              }}
                              className="self-start rounded-input text-xs text-text3 underline-offset-2 hover:text-text2 hover:underline"
                            >
                              Clear product
                            </button>
                          ) : null}
                        </div>
                      );
                    }

                    const id = `campaign-field-${field.name}`;
                    const error = fieldError(field.name);

                    if (field.type === 'textarea') {
                      return (
                        <div key={field.name} className="flex flex-col gap-1.5">
                          <Label
                            htmlFor={id}
                            className="text-[11px] tracking-wide text-text3 uppercase"
                          >
                            {field.label}
                          </Label>
                          <Textarea
                            id={id}
                            name={field.name}
                            readOnly={demo}
                            aria-invalid={error !== undefined}
                            placeholder={field.placeholder || NOT_SET}
                            defaultValue={valueOf(campaign, field.name)}
                            className="min-h-24 leading-relaxed"
                          />
                          {error === undefined ? null : <p className="text-xs text-bad">{error}</p>}
                        </div>
                      );
                    }

                    return (
                      <div key={field.name} className="flex flex-col gap-1.5">
                        <Label
                          htmlFor={id}
                          className="text-[11px] tracking-wide text-text3 uppercase"
                        >
                          {field.label}
                        </Label>
                        <Input
                          id={id}
                          name={field.name}
                          type={field.type === 'date' ? 'date' : 'text'}
                          readOnly={demo}
                          aria-invalid={error !== undefined}
                          placeholder={field.placeholder || NOT_SET}
                          defaultValue={valueOf(campaign, field.name)}
                        />
                        {error === undefined ? null : <p className="text-xs text-bad">{error}</p>}
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}

            {creating ? null : (
              <section className="flex flex-col gap-3">
                <h3 className="border-b border-line pb-1 text-sm font-medium text-text2">
                  Linked collections
                </h3>
                <div className="flex flex-wrap items-center gap-2" data-slot="campaign-collections">
                  {linkedCollections.length === 0 ? (
                    <span className="text-xs text-text3">
                      No collection runs on this campaign yet. A collection chooses its campaign
                      from its own panel.
                    </span>
                  ) : (
                    linkedCollections.map((name) => (
                      <StatusChip key={name} tone="info" label={name} />
                    ))
                  )}
                </div>
              </section>
            )}

            {creating ? null : (
              <>
                <LinkedRecordsSection
                  heading="Email campaigns"
                  slot="campaign-email-campaigns"
                  links={linkedEmailCampaigns}
                  empty="No email campaign runs on this campaign yet. An email campaign picks its campaigns from its own panel."
                />
                <LinkedRecordsSection
                  heading="Email flows"
                  slot="campaign-email-flows"
                  links={linkedEmailFlows}
                  empty="No email flow runs on this campaign yet. A flow picks its campaigns from its own panel."
                />
                <LinkedRecordsSection
                  heading="YouTube copy"
                  slot="campaign-youtube-copy"
                  links={linkedYoutubeCopy}
                  empty="No YouTube copy carries this campaign code yet. A copy picks its campaign from its own panel."
                  mono
                />
                <LinkedRecordsSection
                  heading="Meta copy"
                  slot="campaign-meta-copy"
                  links={linkedMetaCopy}
                  empty="No Meta copy carries this campaign code yet. A copy picks its campaign from its own panel."
                  mono
                />
                <LinkedRecordsSection
                  heading="Concepts"
                  slot="campaign-concepts"
                  links={linkedConcepts}
                  empty="No concept is tied to this campaign yet; the importer fills this link from Airtable."
                  mono
                />
              </>
            )}
          </div>
        </div>

        <footer className="sticky bottom-0 flex flex-wrap items-center justify-end gap-3 border-t border-line bg-surface2 px-4 py-3 sm:px-6">
          {demo ? (
            <p className="mr-auto text-xs text-text3" data-slot="campaign-demo-note">
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
              data-slot="campaign-save"
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
