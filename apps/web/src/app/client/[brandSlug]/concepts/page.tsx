import { chipTone } from '@tas/domain/state';
import { StatusChip, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@tas/ui';

import { resolveClientBrand } from '@/lib/client-brand-source';
import { loadClientConcepts } from '@/lib/client-data-source';

import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

interface Props {
  readonly params: Promise<{ brandSlug: string }>;
}

export default async function ClientConceptsPage({ params }: Props) {
  const { brandSlug } = await params;
  const brand = await resolveClientBrand(brandSlug);
  if (!brand) notFound();

  const concepts = await loadClientConcepts(brand.id);

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-text">Concepts</h1>
        <p className="text-sm text-text2">
          {concepts.length === 0
            ? 'No concepts yet.'
            : `${String(concepts.length)} concept${concepts.length === 1 ? '' : 's'}`}
        </p>
      </div>

      {concepts.length > 0 && (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Batch</TableHead>
                <TableHead>Angle</TableHead>
                <TableHead>Theme</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {concepts.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-sm">{c.name}</TableCell>
                  <TableCell className="text-sm text-text2">{c.batch ?? '—'}</TableCell>
                  <TableCell className="text-sm text-text2">{c.angleName ?? '—'}</TableCell>
                  <TableCell className="text-sm text-text2">{c.themeName ?? '—'}</TableCell>
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
