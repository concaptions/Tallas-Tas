import { chipTone } from '@tas/domain/state';
import { StatusChip, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@tas/ui';

import { resolveClientBrand } from '@/lib/client-brand-source';
import { loadClientCreators } from '@/lib/client-data-source';

import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

interface Props {
  readonly params: Promise<{ brandSlug: string }>;
}

export default async function ClientUgcPage({ params }: Props) {
  const { brandSlug } = await params;
  const brand = await resolveClientBrand(brandSlug);
  if (!brand) notFound();

  const creators = await loadClientCreators(brand.id);

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-text">UGC Creators</h1>
        <p className="text-sm text-text2">
          {creators.length === 0
            ? 'No creators assigned yet.'
            : `${String(creators.length)} creator${creators.length === 1 ? '' : 's'}`}
        </p>
      </div>

      {creators.length > 0 && (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Gender</TableHead>
                <TableHead>Age</TableHead>
                <TableHead>Deadline</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {creators.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="text-sm font-medium">{c.name}</TableCell>
                  <TableCell className="text-sm text-text2">{c.gender ?? '—'}</TableCell>
                  <TableCell className="text-sm text-text2">{c.ageBracket ?? '—'}</TableCell>
                  <TableCell className="text-sm text-text2">
                    {c.deadline ? new Date(c.deadline).toLocaleDateString() : '—'}
                  </TableCell>
                  <TableCell>
                    <StatusChip label={c.clientStatus} tone={chipTone(c.clientStatus)} />
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
