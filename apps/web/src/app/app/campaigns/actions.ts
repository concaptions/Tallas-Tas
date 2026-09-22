'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@clerk/nextjs/server';
import { insertCampaign, updateCampaign, type CampaignInput } from '@tas/db';
import { campaignName } from '@tas/domain/campaigns';
import { z } from 'zod';

import { withBrandScope } from '@/lib/campaigns-source';
import { DEMO_WRITE_REFUSAL, isDemoMode } from '@/lib/demo-mode';
import { campaignsPath } from '@/lib/routes';

export type CampaignFieldName =
  | 'holiday'
  | 'discountOffer'
  | 'code'
  | 'officialDate'
  | 'country'
  | 'description'
  | 'confirmedByClient'
  | 'launched'
  | 'adsLaunchDate'
  | 'adsEndDate'
  | 'productId';

export interface CampaignActionSuccess {
  readonly ok: true;
  readonly id: string;
  readonly savedAt: number;
}

export interface CampaignActionFailure {
  readonly ok: false;
  readonly error: string;
  readonly fieldErrors?: Partial<Record<CampaignFieldName, string>>;
}

export type CampaignActionResult = CampaignActionSuccess | CampaignActionFailure;

const optionalText = z
  .string()
  .trim()
  .transform((v) => (v === '' ? null : v))
  .nullable()
  .optional();

const optionalDate = z
  .string()
  .trim()
  .transform((v) => (v === '' ? null : v))
  .nullable()
  .optional();

const optionalUuid = z
  .string()
  .trim()
  .transform((v) => (v === '' ? null : v))
  .nullable()
  .optional();

const campaignSchema = z.object({
  holiday: optionalText,
  discountOffer: optionalText,
  code: optionalText,
  officialDate: optionalDate,
  country: optionalText,
  description: optionalText,
  confirmedByClient: z.coerce.boolean().default(false),
  launched: z.coerce.boolean().default(false),
  adsLaunchDate: optionalDate,
  adsEndDate: optionalDate,
  productId: optionalUuid,
});

function fieldsOf(formData: FormData): Record<string, unknown> {
  return Object.fromEntries(
    [...formData.entries()]
      .filter(([key]) => key !== 'id')
      .map(([key, value]) => [key, typeof value === 'string' ? value : '']),
  );
}

function failureFrom(error: z.ZodError): CampaignActionFailure {
  const fieldErrors: Partial<Record<CampaignFieldName, string>> = {};
  for (const issue of error.issues) {
    const [first] = issue.path;
    if (typeof first === 'string') {
      fieldErrors[first as CampaignFieldName] ??= issue.message;
    }
  }
  return { ok: false, error: 'Some fields need attention before this can be saved.', fieldErrors };
}

async function actorId(): Promise<string | null> {
  const { userId } = await auth();
  return userId;
}

function parse(formData: FormData): { values: CampaignInput } | CampaignActionFailure {
  const parsed = campaignSchema.safeParse(fieldsOf(formData));
  if (!parsed.success) return failureFrom(parsed.error);
  const { holiday, discountOffer, code, ...rest } = parsed.data;
  const name = campaignName({ holiday, discountOffer, code });
  return {
    values: {
      name,
      holiday: holiday ?? null,
      discountOffer: discountOffer ?? null,
      code: code ?? null,
      ...rest,
      officialDate: rest.officialDate ?? null,
      country: rest.country ?? null,
      description: rest.description ?? null,
      adsLaunchDate: rest.adsLaunchDate ?? null,
      adsEndDate: rest.adsEndDate ?? null,
      productId: rest.productId ?? null,
    },
  };
}

export async function createCampaignAction(
  _previous: CampaignActionResult | null,
  formData: FormData,
): Promise<CampaignActionResult> {
  if (isDemoMode()) {
    return { ok: false, error: DEMO_WRITE_REFUSAL };
  }

  const parsed = parse(formData);
  if ('ok' in parsed) return parsed;

  try {
    const actor = await actorId();
    if (actor === null) {
      return { ok: false, error: 'Your session has expired. Sign in again to save.' };
    }
    const created = await withBrandScope((db, brandId) =>
      insertCampaign(db, brandId, parsed.values, actor),
    );
    if (created === null) {
      return { ok: false, error: 'This workspace has no brand yet.' };
    }
    revalidatePath(campaignsPath);
    return { ok: true, id: created.id, savedAt: Date.now() };
  } catch {
    return { ok: false, error: 'The campaign could not be saved. Try again.' };
  }
}

export async function updateCampaignAction(
  _previous: CampaignActionResult | null,
  formData: FormData,
): Promise<CampaignActionResult> {
  if (isDemoMode()) {
    return { ok: false, error: DEMO_WRITE_REFUSAL };
  }

  const id = formData.get('id');
  if (typeof id !== 'string' || id === '') {
    return { ok: false, error: 'This campaign could not be identified.' };
  }

  const parsed = parse(formData);
  if ('ok' in parsed) return parsed;

  try {
    const actor = await actorId();
    if (actor === null) {
      return { ok: false, error: 'Your session has expired. Sign in again to save.' };
    }
    const saved = await withBrandScope((db, brandId) =>
      updateCampaign(db, brandId, id, parsed.values, actor),
    );
    if (saved === null) {
      return { ok: false, error: 'That campaign is no longer available.' };
    }
    revalidatePath(campaignsPath);
    return { ok: true, id: saved.id, savedAt: Date.now() };
  } catch {
    return { ok: false, error: 'The campaign could not be saved. Try again.' };
  }
}
