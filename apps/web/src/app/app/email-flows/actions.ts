'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@clerk/nextjs/server';
import {
  insertEmailFlow,
  syncEmailFlowCampaigns,
  updateEmailFlow,
  type EmailFlowInput,
} from '@tas/db';
import { emailChannels, emailFlowStatuses } from '@tas/db/schema';
import { z } from 'zod';

import { DEMO_WRITE_REFUSAL, isDemoMode } from '@/lib/demo-mode';
import { assertWorkspaceLive } from '@/lib/removed-workspaces';
import { withBrandScope } from '@/lib/email-flows-source';
import { emailFlowsPath } from '@/lib/routes';

import { EMAIL_FLOW_FIELDS, isHttpUrl, parseUrlList, type EmailFlowFieldName } from './fields';

/**
 * The Email Flows route's two mutations. Both follow `products/actions.ts` exactly:
 *
 * 1. refuse immediately in DEMO MODE, before any validation, actor lookup or connection — the demo
 *    deployment is unauthenticated, so a write must never reach a database;
 * 2. validate with zod: a flow needs a name; every other stored field is optional and an empty text
 *    is stored as NULL, never as an empty string, so "unset" has one representation. Status and Type
 *    must be keys of the `@tas/db/schema` vocabularies; the Klaviyo link and every line of the two
 *    attachment fields must be a full `http(s)` URL; the campaign links are uuids;
 * 3. write through the scoped `@tas/db` functions, which put `brand_id` on every statement, then
 *    replace the "Campaigns & Offers" links through the scoped junction sync;
 * 4. revalidate the page and return a typed result. Neither ever throws to the client.
 */
export interface EmailFlowActionSuccess {
  readonly ok: true;
  readonly id: string;
  /** Changes with every save, so the panel can react to two successful saves in a row. */
  readonly savedAt: number;
}

export interface EmailFlowActionFailure {
  readonly ok: false;
  readonly error: string;
  readonly fieldErrors?: Partial<Record<EmailFlowFieldName, string>>;
}

export type EmailFlowActionResult = EmailFlowActionSuccess | EmailFlowActionFailure;

const LINK_MESSAGE = 'Enter a full link, starting with https://';
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** A text column: trimmed, and empty means NULL. */
const text = z
  .string()
  .trim()
  .transform((value) => (value === '' ? null : value))
  .nullable();

/** A `date` column from an `<input type="date">`: empty means NULL, a value is a calendar date. */
const optionalDate = text.refine(
  (value) => value === null || ISO_DATE.test(value),
  'Enter a date as YYYY-MM-DD.',
);

/** The optional Klaviyo link: empty means NULL, a value must still be a real link. */
const optionalLink = text.refine((value) => value === null || isHttpUrl(value), LINK_MESSAGE);

/** An attachment column from its one-URL-per-line textarea: an empty list is stored as NULL. */
const urlList = z
  .string()
  .transform(parseUrlList)
  .refine((list) => list.every(isHttpUrl), 'Every line must be a full link, starting with https://')
  .transform((list) => (list.length === 0 ? null : list));

const STATUS_KEYS = emailFlowStatuses.map((option) => option.key);
const TYPE_KEYS = emailChannels.map((option) => option.key);

/** A single-select: one of the vocabulary's keys, or empty for "not set", stored as NULL. */
const status = z
  .union([z.enum(STATUS_KEYS), z.literal('')])
  .nullish()
  .transform((value) => (value === '' || value === undefined ? null : value));

const type = z
  .union([z.enum(TYPE_KEYS), z.literal('')])
  .nullish()
  .transform((value) => (value === '' || value === undefined ? null : value));

const emailFlowSchema = z.object({
  flowName: z.string().trim().min(1, 'A flow needs a name.'),
  expectedSetupDate: optionalDate,
  flowPurpose: text,
  status,
  copywriting: text,
  design: urlList,
  klaviyoLink: optionalLink,
  type,
  inspo: urlList,
  assigneeId: text,
  campaignIds: z.array(z.uuid()),
});

const FIELD_NAMES = new Set<string>(EMAIL_FLOW_FIELDS.map((field) => field.name));

/**
 * `FormData` entries are `FormDataEntryValue | null`; zod sees strings, or nothing. The stored
 * fields are read one by one from `EMAIL_FLOW_FIELDS`, and the campaign links are the repeated
 * `campaignIds` hidden inputs the panel's chip picker posts.
 */
function fieldsOf(formData: FormData): Record<string, unknown> {
  const single = (key: string): string => {
    const value = formData.get(key);
    return typeof value === 'string' ? value : '';
  };
  return {
    ...Object.fromEntries(EMAIL_FLOW_FIELDS.map((field) => [field.name, single(field.name)])),
    campaignIds: formData
      .getAll('campaignIds')
      .filter((value): value is string => typeof value === 'string'),
  };
}

function failureFrom(error: z.ZodError): EmailFlowActionFailure {
  const fieldErrors: Partial<Record<EmailFlowFieldName, string>> = {};
  for (const issue of error.issues) {
    const [first] = issue.path;
    if (typeof first === 'string' && FIELD_NAMES.has(first)) {
      fieldErrors[first as EmailFlowFieldName] ??= issue.message;
    }
  }
  return { ok: false, error: 'Some fields need attention before this can be saved.', fieldErrors };
}

/** Who is writing. Live mode only: in demo mode both actions have already returned. */
async function actorId(): Promise<string | null> {
  const { userId } = await auth();
  return userId;
}

interface ParsedEmailFlow {
  readonly values: EmailFlowInput;
  readonly campaignIds: readonly string[];
}

function parse(formData: FormData): ParsedEmailFlow | EmailFlowActionFailure {
  const parsed = emailFlowSchema.safeParse(fieldsOf(formData));
  if (!parsed.success) return failureFrom(parsed.error);
  const { campaignIds, ...values } = parsed.data;
  return { values, campaignIds };
}

/** Creates an email flow in the actor's brand and links its campaigns. */
export async function createEmailFlowAction(
  _previous: EmailFlowActionResult | null,
  formData: FormData,
): Promise<EmailFlowActionResult> {
  // Retired for every brand (Talal 2026-10-07): refuse before demo mode, validation or any write.
  const retired = assertWorkspaceLive('email-flows');
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
      return { ok: false, error: 'Your session has expired. Sign in again to save.' };
    }
    const created = await withBrandScope(async (db, brandId) => {
      const row = await insertEmailFlow(db, brandId, parsed.values, actor);
      await syncEmailFlowCampaigns(db, brandId, row.id, parsed.campaignIds);
      return row;
    });
    if (created === null) {
      return { ok: false, error: 'This workspace has no brand yet.' };
    }
    revalidatePath(emailFlowsPath);
    return { ok: true, id: created.id, savedAt: Date.now() };
  } catch {
    return { ok: false, error: 'The flow could not be saved. Try again.' };
  }
}

/** Patches one email flow of the actor's brand; another brand's id simply never resolves. */
export async function updateEmailFlowAction(
  _previous: EmailFlowActionResult | null,
  formData: FormData,
): Promise<EmailFlowActionResult> {
  // Retired for every brand (Talal 2026-10-07): refuse before demo mode, validation or any write.
  const retired = assertWorkspaceLive('email-flows');
  if (retired) return retired;

  if (isDemoMode()) {
    return { ok: false, error: DEMO_WRITE_REFUSAL };
  }

  const id = formData.get('id');
  if (typeof id !== 'string' || id === '') {
    return { ok: false, error: 'This flow could not be identified.' };
  }

  const parsed = parse(formData);
  if ('ok' in parsed) {
    return parsed;
  }

  try {
    const actor = await actorId();
    if (actor === null) {
      return { ok: false, error: 'Your session has expired. Sign in again to save.' };
    }
    const saved = await withBrandScope(async (db, brandId) => {
      const row = await updateEmailFlow(db, brandId, id, parsed.values, actor);
      if (row === null) return null;
      await syncEmailFlowCampaigns(db, brandId, row.id, parsed.campaignIds);
      return row;
    });
    if (saved === null) {
      return { ok: false, error: 'That flow is no longer available.' };
    }
    revalidatePath(emailFlowsPath);
    return { ok: true, id: saved.id, savedAt: Date.now() };
  } catch {
    return { ok: false, error: 'The flow could not be saved. Try again.' };
  }
}
