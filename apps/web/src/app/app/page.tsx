import { OrganizationSwitcher } from '@clerk/nextjs';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@tas/ui';

import { AccountSummary } from '@/components/account-summary';
import { CsmCards } from '@/components/overview/csm-cards';
import { MetricCards } from '@/components/overview/metric-cards';
import { PipelineChart } from '@/components/overview/pipeline-chart';
import { RoleDashboardSection } from '@/components/role-dashboard';
import { Icon, type IconName } from '@/components/shell/icons';
import { loadActorBrandPanels, loadOverviewPanels } from '@/lib/dashboard-source';
import { loadActiveRole, loadOverview } from '@/lib/data-source';
import { isDemoMode } from '@/lib/demo-mode';
import { conceptsPath, personasPath, themesPath } from '@/lib/routes';

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
  // The dashboard is drawn for the current user's role on the active brand (Sprint 12); resolved
  // first because the role decides which tiles `loadRoleDashboard` counts. Demo mode and anyone
  // without a role here resolve to `admin` — the all-cards view, unchanged from before role detection.
  const role = await loadActiveRole();
  // Independent reads: awaited together, not one after the other. All share the request's
  // connection and its once-per-request brand resolution. The third is the cross-client shell's
  // data (AI-06/AI-09): the signed-in actor's OWN assigned brands, one panel each — empty for an
  // actor with fewer than two, which keeps the single-brand Overview exactly as it was.
  const [{ brand, counts }, { dashboard, metrics, pipeline }, brandPanels] = await Promise.all([
    loadOverview(),
    loadOverviewPanels(role),
    loadActorBrandPanels(role),
  ]);

  // The library sections the Overview surfaces. ANGLES IS NOT ONE OF THEM: action item 8 took it
  // out of this section, the same removal that dropped the CSM's "Angles in library" tile. The
  // Angles table is unchanged and still reached from the sidebar; only the duplicate count is gone.
  const cards: readonly SectionCard[] = [
    {
      label: 'Personas',
      icon: 'personas',
      count: counts.personas,
      blurb: 'Who the creative speaks to.',
      href: personasPath,
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

      <MetricCards cards={metrics} />

      <CsmCards role={role} panels={brandPanels} />

      <PipelineChart steps={pipeline} />

      <RoleDashboardSection dashboard={dashboard} />

      <section
        aria-labelledby="library-heading"
        data-slot="overview-library"
        className="flex flex-col gap-3"
      >
        <h2 id="library-heading" className="text-sm font-medium text-text2">
          Library
        </h2>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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

      {/* The TwoTrackApproval showcase that used to sit here was design-system furniture with
          hardcoded statuses, not a dashboard element — the reference has no such block (AI-06).
          It still renders on /design-system, where component showcases live. */}

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
