import { desc, eq } from 'drizzle-orm';

import type { Db } from './db';
import { onboardingForms, type NewOnboardingForm, type OnboardingForm } from './schema';
import { withBrand } from './tenancy';

type ManagedColumn =
  'id' | 'brandId' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy' | 'deletedAt';

export type OnboardingFormInput = Omit<NewOnboardingForm, ManagedColumn>;

export type OnboardingFormListRow = OnboardingForm;

export async function listOnboardingForms(
  db: Db,
  brandId: string,
): Promise<OnboardingFormListRow[]> {
  return withBrand(db, brandId).select(onboardingForms).orderBy(desc(onboardingForms.createdAt));
}

export async function getOnboardingFormByToken(
  db: Db,
  token: string,
): Promise<OnboardingFormListRow | null> {
  const [row] = await db
    .select()
    .from(onboardingForms)
    .where(eq(onboardingForms.shareToken, token))
    .limit(1);
  return row ?? null;
}

export async function insertOnboardingForm(
  db: Db,
  brandId: string,
  values: OnboardingFormInput,
  actorId: string,
): Promise<OnboardingForm> {
  const [row] = await withBrand(db, brandId)
    .insert(onboardingForms, { ...values, createdBy: actorId, updatedBy: actorId })
    .returning();
  if (row === undefined) throw new Error('onboarding_forms insert returned no row');
  return row;
}
