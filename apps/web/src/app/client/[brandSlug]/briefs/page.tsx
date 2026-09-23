import { chipTone } from '@tas/domain/state';
import { StatusChip, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@tas/ui';

import { resolveClientBrand } from '@/lib/client-brand-source';
import { loadClientCreatives } from '@/lib/client-data-source';

import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

interface Props {
  readonly params: Promise<{ brandSlug: string }>;
}

export default async function ClientBriefsPage({ params }: Props) {
  const { brandSlug } = await params;
  const brand = await resolveClientBrand(brandSlug);
  if (!brand) notFound();

  const briefs = await loadClientCreatives(brand.id);

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-text">Creative Briefs</h1>
        <p className="text-sm text-text2">
          {briefs.length === 0
            ? 'No briefs ready for review.'
            : `${String(briefs.length)} brief${briefs.length === 1 ? '' : 's'}`}
        </p>
      </div>

      {briefs.length > 0 && (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Funnel</TableHead>
                <TableHead>Platform</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {briefs.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-mono text-sm">{b.name}</TableCell>
                  <TableCell className="text-sm text-text2">{b.type}</TableCell>
                  <TableCell className="text-sm text-text2">{b.funnel}</TableCell>
                  <TableCell className="text-sm text-text2">
                    {b.platform.length > 0 ? b.platform.join(', ') : '—'}
                  </TableCell>
                  <TableCell>
                    <StatusChip label={b.clientStatus} tone={chipTone(b.clientStatus)} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
