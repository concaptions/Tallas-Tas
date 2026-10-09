'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@clerk/nextjs/server';
import {
  emailCampaignStatuses,
  emailCampaignTypes,
  emailChannels,
  insertEmailCampaign,
  syncEmailCampaignCampaigns,
  syncEmailCampaignCollections,
  syncEmailCampaignProducts,
  updateEmailCampaign,
  type Db,
  type EmailCampaignInput,
} from '@tas/db';
import { z } from 'zod';

import { DEMO_WRITE_REFUSAL, isDemoMode } from '@/lib/demo-mode';
import { assertWorkspaceLive } from '@/lib/removed-workspaces';
import { withBrandScope } from '@/lib/email-campaigns-source';
import { emailCampaignsPath } from '@/lib/routes';

/**
 * The Email Campaigns route's mutations (Airtable "Email Campaigns Management", audit §2.10). All
 * follow `products/actions.ts`: refuse in DEMO MODE before anything else; validate with zod (select
 * values must be KEYS of the `@tas/db` vocabularies, dates `YYYY-MM-DD`, links `http(s)`, the two
 * attachment fields one URL per line; empty means NULL); write through the scoped `@tas/db`
 * functions, then replace the three record links with the junction sync helpers; revalidate and
 * return a typed result. Nothing here throws to the client.
 */

/** The twelve writable columns. `fields.ts` labels these; nothing else is editable. */
export type EmailCampaignFieldName =
  | 'name'
  | 'campaignPurpose'
  | 'status'
  | 'sendDate'
  | 'copywriting'
  | 'assigneeId'
  | 'copyLink'
  | 'design'
  | 'klaviyoLink'
  | 'assets'
  | 'type'
  | 'channel';

/** The three record links, posted as repeated hidden inputs of the same name. */
export type EmailCampaignLinkName = 'campaignOfferIds' | 'productIds' | 'collectionIds';

export interface EmailCampaignActionSuccess {
  readonly ok: true;
  readonly id: string;
  /** Changes with every save, so the panel can react to two successful saves in a row. */
  readonly savedAt: number;
}

export interface EmailCampaignActionFailure {
  readonly ok: false;
  readonly error: string;
  readonly fieldErrors?: Partial<Record<EmailCampaignFieldName, string>>;
}

export type EmailCampaignActionResult = EmailCampaignActionSuccess | EmailCampaignActionFailure;

const FIELD_NAMES: readonly EmailCampaignFieldName[] = [
  'name',
  'campaignPurpose',
  'status',
  'sendDate',
  'copywriting',
  'assigneeId',
  'copyLink',
  'design',
  'klaviyoLink',
  'assets',
  'type',
  'channel',
];

const LINK_NAMES: readonly EmailCampaignLinkName[] = [
  'campaignOfferIds',
  'productIds',
  'collectionIds',
];

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

const LINK_MESSAGE = 'Enter a full link, starting with https://';
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** A vocabulary's keys as the non-empty tuple `z.enum` wants. */
function keyTuple<K extends string>(vocabulary: readonly { key: K }[]): [K, ...K[]] {
  const [head, ...tail] = vocabulary.map((entry) => entry.key);
  if (head === undefined) throw new Error('A select vocabulary cannot be empty.');
  return [head, ...tail];
}

/** Empty is NULL; a value must be one of the vocabulary's keys. */
function optionalChoice<K extends string>(vocabulary: readonly { key: K }[], message: string) {
  return z.preprocess(
    (value) => (value === '' ? null : value),
    z.enum(keyTuple(vocabulary), { error: message }).nullable(),
  );
}

const optionalText = z.string().transform((value) => (value.trim() === '' ? null : value.trim()));

const optionalDate = z
  .string()
  .trim()
  .transform((value) => (value === '' ? null : value))
  .nullable()
  .refine((value) => value === null || ISO_DATE.test(value), 'Enter a date as YYYY-MM-DD.');

const optionalLink = z
  .string()
  .trim()
  .transform((value) => (value === '' ? null : value))
  .nullable()
  .refine((value) => value === null || isHttpUrl(value), LINK_MESSAGE);

/** One URL per line, stored as an array; no lines means NULL. */
const urlList = z
  .string()
  .transform((text) =>
    text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line !== ''),
  )
  .refine((lines) => lines.every(isHttpUrl), `Every line must be a full link. ${LINK_MESSAGE}`)
  .transform((lines) => (lines.length === 0 ? null : lines));

const emailCampaignSchema = z.object({
  name: z.string().trim().min(1, 'An email campaign needs a name.'),
  campaignPurpose: optionalText,
  status: optionalChoice(emailCampaignStatuses, 'Pick a status from the list.'),
  sendDate: optionalDate,
  copywriting: optionalText,
  assigneeId: optionalText,
  copyLink: optionalLink,
  design: urlList,
  klaviyoLink: optionalLink,
  assets: urlList,
  type: optionalChoice(emailCampaignTypes, 'Pick a type from the list.'),
  channel: optionalChoice(emailChannels, 'Pick a channel from the list.'),
});

type Links = Record<EmailCampaignLinkName, string[]>;

/** `FormData` entries are `FormDataEntryValue | null`; zod sees strings, or nothing. */
function fieldsOf(formData: FormData): Record<string, unknown> {
  return Object.fromEntries(
    FIELD_NAMES.map((name) => {
      const value = formData.get(name);
      return [name, typeof value === 'string' ? value : ''];
    }),
  );
}

function linksOf(formData: FormData): Links {
  const links: Links = { campaignOfferIds: [], productIds: [], collectionIds: [] };
  for (const name of LINK_NAMES) {
    links[name] = formData
      .getAll(name)
      .filter((value): value is string => typeof value === 'string' && value !== '');
  }
  return links;
}

function failureFrom(error: z.ZodError): EmailCampaignActionFailure {
  const fieldErrors: Partial<Record<EmailCampaignFieldName, string>> = {};
  for (const issue of error.issues) {
    const [head] = issue.path;
    if (typeof head === 'string') {
      fieldErrors[head as EmailCampaignFieldName] ??= issue.message;
    }
  }
  return { ok: false, error: 'Some fields need attention before this can be saved.', fieldErrors };
}

/** Who is writing. Live mode only: in demo mode every action has already returned. */
async function actorId(): Promise<string | null> {
  const { userId } = await auth();
  return userId;
}

function parse(
  formData: FormData,
): { values: EmailCampaignInput; links: Links } | EmailCampaignActionFailure {
  const parsed = emailCampaignSchema.safeParse(fieldsOf(formData));
  return parsed.success
    ? { values: parsed.data, links: linksOf(formData) }
    : failureFrom(parsed.error);
}

/** Replaces the three record links; the helpers keep only the brand's own live targets. */
async function syncLinks(db: Db, brandId: string, id: string, links: Links): Promise<void> {
  await syncEmailCampaignCampaigns(db, brandId, id, links.campaignOfferIds);
  await syncEmailCampaignProducts(db, brandId, id, links.productIds);
  await syncEmailCampaignCollections(db, brandId, id, links.collectionIds);
}

const SAVE_FAILED = 'The email campaign could not be saved. Try again.';
const SESSION_EXPIRED = 'Your session has expired. Sign in again to save.';

/** Creates an email campaign in the actor's brand, links included. */
export async function createEmailCampaignAction(
  _previous: EmailCampaignActionResult | null,
  formData: FormData,
): Promise<EmailCampaignActionResult> {
  // Retired for every brand (Talal 2026-10-07): refuse before demo mode, validation or any write.
  const retired = assertWorkspaceLive('email-campaigns');
  if (retired) return retired;

  if (isDemoMode()) {
    return { ok: false, error: DEMO_WRITE_REFUSAL };
  }

  const parsed = parse(formData);
  if ('ok' in parsed) {
    return parsed;
  }

  try {
    const actor = await actorId();
    if (actor === null) {
      return { ok: false, error: SESSION_EXPIRED };
    }
    const created = await withBrandScope(async (db, brandId) => {
      const row = await insertEmailCampaign(db, brandId, parsed.values, actor);
      await syncLinks(db, brandId, row.id, parsed.links);
      return row;
    });
    if (created === null) {
      return { ok: false, error: 'This workspace has no brand yet.' };
    }
    revalidatePath(emailCampaignsPath);
    return { ok: true, id: created.id, savedAt: Date.now() };
  } catch {
    return { ok: false, error: SAVE_FAILED };
  }
}

/** Patches one email campaign of the actor's brand; another brand's id simply never resolves. */
export async function updateEmailCampaignAction(
  _previous: EmailCampaignActionResult | null,
  formData: FormData,
): Promise<EmailCampaignActionResult> {
  // Retired for every brand (Talal 2026-10-07): refuse before demo mode, validation or any write.
  const retired = assertWorkspaceLive('email-campaigns');
  if (retired) return retired;

  if (isDemoMode()) {
    return { ok: false, error: DEMO_WRITE_REFUSAL };
  }

  const id = formData.get('id');
  if (typeof id !== 'string' || id === '') {
    return { ok: false, error: 'This email campaign could not be identified.' };
  }

  const parsed = parse(formData);
  if ('ok' in parsed) {
    return parsed;
  }

  try {
    const actor = await actorId();
    if (actor === null) {
      return { ok: false, error: SESSION_EXPIRED };
    }
    const saved = await withBrandScope(async (db, brandId) => {
      const row = await updateEmailCampaign(db, brandId, id, parsed.values, actor);
      if (row !== null) await syncLinks(db, brandId, row.id, parsed.links);
      return row;
    });
    if (saved === null) {
      return { ok: false, error: 'That email campaign is no longer available.' };
    }
    revalidatePath(emailCampaignsPath);
    return { ok: true, id: saved.id, savedAt: Date.now() };
  } catch {
    return { ok: false, error: SAVE_FAILED };
  }
}

/** A Kanban drop: one of the three group fields set to one column's value. */
export interface MoveEmailCampaignInput {
  readonly id: string;
  readonly field: 'status' | 'type' | 'channel';
  readonly value: string;
}

const moveSchema = z.discriminatedUnion('field', [
  z.object({
    id: z.string().min(1),
    field: z.literal('status'),
    value: z.enum(keyTuple(emailCampaignStatuses)),
  }),
  z.object({
    id: z.string().min(1),
    field: z.literal('type'),
    value: z.enum(keyTuple(emailCampaignTypes)),
  }),
  z.object({
    id: z.string().min(1),
    field: z.literal('channel'),
    value: z.enum(keyTuple(emailChannels)),
  }),
]);

/** Moves a card between Kanban columns: the same scoped update the panel uses, one field at a time. */
export async function moveEmailCampaignAction(
  input: MoveEmailCampaignInput,
): Promise<EmailCampaignActionResult> {
  // Retired for every brand (Talal 2026-10-07): refuse before demo mode, validation or any write.
  const retired = assertWorkspaceLive('email-campaigns');
  if (retired) return retired;

  if (isDemoMode()) {
    return { ok: false, error: DEMO_WRITE_REFUSAL };
  }

  const parsed = moveSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'That column is not a value this field can take.' };
  }
  const move = parsed.data;
  const patch: Partial<EmailCampaignInput> =
    move.field === 'status'
      ? { status: move.value }
      : move.field === 'type'
        ? { type: move.value }
        : { channel: move.value };

  try {
    const actor = await actorId();
    if (actor === null) {
      return { ok: false, error: SESSION_EXPIRED };
    }
    const saved = await withBrandScope((db, brandId) =>
      updateEmailCampaign(db, brandId, move.id, patch, actor),
    );
    if (saved === null) {
      return { ok: false, error: 'That email campaign is no longer available.' };
    }
    revalidatePath(emailCampaignsPath);
    return { ok: true, id: saved.id, savedAt: Date.now() };
  } catch {
    return { ok: false, error: SAVE_FAILED };
  }
}
