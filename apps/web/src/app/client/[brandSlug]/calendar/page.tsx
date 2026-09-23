import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@tas/ui';

import { resolveClientBrand } from '@/lib/client-brand-source';
import { loadClientCalendar } from '@/lib/client-data-source';

import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

interface Props {
  readonly params: Promise<{ brandSlug: string }>;
}

export default async function ClientCalendarPage({ params }: Props) {
  const { brandSlug } = await params;
  const brand = await resolveClientBrand(brandSlug);
  if (!brand) notFound();

  const events = await loadClientCalendar(brand.id);

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-text">Promotional Calendar</h1>
        <p className="text-sm text-text2">
          {events.length === 0
            ? 'No calendar events yet.'
            : `${String(events.length)} event${events.length === 1 ? '' : 's'}`}
        </p>
      </div>

      {events.length > 0 && (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Holiday</TableHead>
                <TableHead>Official Date</TableHead>
                <TableHead>Ads Launch</TableHead>
                <TableHead>Ads End</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-mono text-sm">{e.name}</TableCell>
                  <TableCell className="text-sm text-text2">{e.holiday ?? '—'}</TableCell>
                  <TableCell className="text-sm text-text2">{e.officialDate ?? '—'}</TableCell>
                  <TableCell className="text-sm text-text2">{e.adsLaunchDate ?? '—'}</TableCell>
                  <TableCell className="text-sm text-text2">{e.adsEndDate ?? '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
