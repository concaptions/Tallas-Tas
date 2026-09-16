import { OrganizationSwitcher } from '@clerk/nextjs';
import { auth } from '@clerk/nextjs/server';

import { AccountSummary } from '@/components/account-summary';
import { appPath } from '@/lib/routes';

export default async function AppPage() {
  // Second line of defence behind the middleware: a render without a session redirects to sign-in.
  await auth.protect();

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 p-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Workspace</h1>
        {/* Lets the agency organisation be created on first run (D-003: one org, the agency). */}
        <OrganizationSwitcher
          afterCreateOrganizationUrl={appPath}
          afterSelectOrganizationUrl={appPath}
        />
      </header>
      <AccountSummary />
    </main>
  );
}
