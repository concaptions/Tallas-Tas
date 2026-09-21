import { isDemoMode } from '@/lib/demo-mode';
import { loadOnboardingForms } from '@/lib/onboarding-forms-source';

import { OnboardingFormsTable, type OnboardingFormItem } from './onboarding-forms-table';

export default async function OnboardingFormsPage() {
  const { rows } = await loadOnboardingForms();
  const demo = isDemoMode();
  const items: OnboardingFormItem[] = rows.map((form) => ({
    form,
    fieldCount: (JSON.parse(form.fieldsJson) as unknown[]).length,
  }));
  return <OnboardingFormsTable items={items} demo={demo} />;
}
