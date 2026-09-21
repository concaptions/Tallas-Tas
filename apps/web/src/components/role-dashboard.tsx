import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@tas/ui';

import type { RoleDashboard } from '@/lib/dashboard-source';

export function RoleDashboardSection({ dashboard }: { readonly dashboard: RoleDashboard }) {
  return (
    <section aria-labelledby="role-heading" className="flex flex-col gap-3">
      <h2 id="role-heading" className="text-sm font-medium text-text2">
        {dashboard.roleLabel} — Your queue
      </h2>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {dashboard.items.map((item) => (
          <li key={item.label}>
            <Link href={item.href} className="block h-full rounded-card">
              <Card className="h-full gap-3 py-4 transition-colors hover:border-accent-line">
                <CardHeader className="px-4">
                  <CardTitle className="text-sm text-text2">{item.label}</CardTitle>
                </CardHeader>
                <CardContent className="px-4">
                  <p className="font-mono text-3xl leading-none text-text">{item.count}</p>
                </CardContent>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
