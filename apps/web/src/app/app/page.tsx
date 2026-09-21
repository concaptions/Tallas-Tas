import { OrganizationSwitcher } from '@clerk/nextjs';
import Link from 'next/link';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  TwoTrackApproval,
} from '@tas/ui';

import { AccountSummary } from '@/components/account-summary';
import { RoleDashboardSection } from '@/components/role-dashboard';
import { Icon, type IconName } from '@/components/shell/icons';
import { roleDashboard } from '@/lib/dashboard-source';
import { loadOverview } from '@/lib/data-source';
import { isDemoMode } from '@/lib/demo-mode';
import { anglesPath, conceptsPath, personasPath, themesPath } from '@/lib/routes';

/**
 * The workspace Overview. Counts come from the data source, which is the demo fixtures when Clerk
 * is not configured and the database when it is; the page does not know which and does not branch.
 */
interface SectionCard {
  readonly label: string;
  readonly icon: IconName;
  readonly count: number;
  readonly blurb: string;
  readonly href?: string;
}

export default async function OverviewPage() {
  const demo = isDemoMode();
  const { brand, counts } = await loadOverview();
  const dashboard = roleDashboard('admin');

  const cards: readonly SectionCard[] = [
    {
      label: 'Personas',
      icon: 'personas',
      count: counts.personas,
      blurb: 'Who the creative speaks to.',
      href: personasPath,
    },
    {
      label: 'Angles',
      icon: 'angles',
      count: counts.angles,
      blurb: 'The argument each ad makes.',
      href: anglesPath,
    },
    {
      label: 'Themes',
      icon: 'themes',
      count: counts.themes,
      blurb: 'The global production library.',
      href: themesPath,
    },
    {
      label: 'Concepts',
      icon: 'concepts',
      count: counts.concepts,
      blurb: 'Batch, angle and theme, named.',
      href: conceptsPath,
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <p className="font-mono text-[11px] tracking-wide text-text3 uppercase">Overview</p>
        <h1 className="text-2xl font-semibold tracking-tight text-text">
          {brand?.name ?? 'No brand yet'}
        </h1>
        <p className="text-sm text-text2">
          {brand === null
            ? 'Create a brand to start briefing creative.'
            : demo
              ? 'Sample workspace. Every number below is a fixture shipped with the repository.'
              : 'Everything briefed for this brand.'}
        </p>
      </header>

      <RoleDashboardSection dashboard={dashboard} />

      <section aria-labelledby="library-heading" className="flex flex-col gap-3">
        <h2 id="library-heading" className="text-sm font-medium text-text2">
          Library
        </h2>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((card) => {
            const body = (
              <Card
                className="h-full gap-3 py-4 transition-colors data-[live=true]:hover:border-accent-line"
                data-live={card.href !== undefined}
              >
                <CardHeader className="px-4">
                  <CardTitle className="flex items-center gap-2 text-sm text-text2">
                    <Icon name={card.icon} className="size-4 text-text3" />
                    {card.label}
                  </CardTitle>
                  <CardDescription className="text-xs text-text3">{card.blurb}</CardDescription>
                </CardHeader>
                <CardContent className="px-4">
                  <p className="font-mono text-3xl leading-none text-text">{card.count}</p>
                  <p className="mt-2 text-[11px] text-text3">
                    {card.href === undefined ? 'Section not available yet' : 'Open section'}
                  </p>
                </CardContent>
              </Card>
            );

            return (
              <li key={card.label}>
                {card.href === undefined ? (
                  <div aria-disabled="true" className="h-full opacity-70">
                    {body}
                  </div>
                ) : (
                  <Link href={card.href} className="block h-full rounded-card">
                    {body}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="approval-heading" className="flex flex-col gap-3">
        <h2 id="approval-heading" className="text-sm font-medium text-text2">
          Approval tracks
        </h2>
        <p className="max-w-2xl text-xs text-text3">
          Internal status is the team&apos;s; the client bar stays locked until internal reaches
          Approved. A creative reaches the client interface only then.
        </p>
        <div className="max-w-xl">
          <TwoTrackApproval track="video" internal="ad_submitted" client="pending_for_approval" />
        </div>
      </section>

      {/* Clerk-only: the agency organisation is created on first run (D-003). Never rendered in
          demo mode, where no ClerkProvider exists for these components to read. */}
      {demo ? null : (
        <section aria-labelledby="account-heading" className="flex flex-col gap-3">
          <h2 id="account-heading" className="text-sm font-medium text-text2">
            Account
          </h2>
          <OrganizationSwitcher
            afterCreateOrganizationUrl="/app"
            afterSelectOrganizationUrl="/app"
          />
          <AccountSummary />
        </section>
      )}
    </div>
  );
}
