'use server';

import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { createAutoDb, onboardBrand, type OnboardBrandInput } from '@tas/db';
import { defaultInterfaceConfig, slugify, validateBrandDraft, type BrandRole } from '@tas/domain';
import { serverEnv } from '@tas/env';

import { isDemoMode } from '@/lib/demo-mode';
import { appPath } from '@/lib/routes';

export interface OnboardResult {
  readonly ok: boolean;
  readonly errors?: readonly { field: string; message: string }[];
}

export async function createBrandAction(formData: FormData): Promise<OnboardResult> {
  if (isDemoMode()) {
    return {
      ok: false,
      errors: [{ field: 'name', message: 'Cannot create brands in demo mode.' }],
    };
  }

  const name = (formData.get('name') as string | null)?.trim() ?? '';
  const slug = (formData.get('slug') as string | null)?.trim() ?? slugify(name);
  const website = (formData.get('website') as string | null)?.trim() ?? '';

  const teamJson = formData.get('team') as string | null;
  const team = (teamJson ? JSON.parse(teamJson) : []) as { userId: string; role: BrandRole }[];

  const draft = { name, slug, website, team };
  const validationErrors = validateBrandDraft(draft);
  if (validationErrors.length > 0) {
    return { ok: false, errors: validationErrors };
  }

  const session = await auth.protect();
  const databaseUrl = serverEnv().DATABASE_URL;
  if (databaseUrl === undefined) {
    return { ok: false, errors: [{ field: 'name', message: 'Database is not configured.' }] };
  }

  const db = createAutoDb(databaseUrl);
  try {
    const { findAgencyByClerkOrg } = await import('@tas/db');
    const orgId = session.orgId;
    if (orgId === undefined) {
      return { ok: false, errors: [{ field: 'name', message: 'No organization found.' }] };
    }

    const agency = await findAgencyByClerkOrg(db, orgId);
    if (agency === null) {
      return {
        ok: false,
        errors: [{ field: 'name', message: 'Agency not found for this organization.' }],
      };
    }

    const defaults = defaultInterfaceConfig() as OnboardBrandInput['interfaceDefaults'];

    await onboardBrand(db, {
      agencyId: agency.agencyId,
      templateBrandId: agency.templateBrandId,
      name,
      slug,
      website: website || undefined,
      actorId: session.userId,
      team,
      interfaceDefaults: defaults,
    });
  } finally {
    await db.$client.end();
  }

  redirect(appPath);
}
