import { OnboardWizard } from './onboard-wizard';

export default function OnboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-text">Add a new brand</h1>
        <p className="mt-1 text-sm text-text3">
          Set up a new client workspace. Interface config and notifications will be seeded from
          defaults — you can tune them later.
        </p>
      </div>
      <OnboardWizard />
    </div>
  );
}
