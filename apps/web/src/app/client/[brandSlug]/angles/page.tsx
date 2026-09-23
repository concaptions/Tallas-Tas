import { Badge } from '@tas/ui';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@tas/ui';

import { resolveClientBrand } from '@/lib/client-brand-source';
import { loadClientAngles } from '@/lib/client-data-source';

import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

interface Props {
  readonly params: Promise<{ brandSlug: string }>;
}

export default async function ClientAnglesPage({ params }: Props) {
  const { brandSlug } = await params;
  const brand = await resolveClientBrand(brandSlug);
  if (!brand) notFound();

  const angles = await loadClientAngles(brand.id);

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-text">Angles</h1>
        <p className="text-sm text-text2">
          {angles.length === 0
            ? 'No angles defined yet.'
            : `${String(angles.length)} angle${angles.length === 1 ? '' : 's'}`}
        </p>
      </div>

      {angles.length > 0 && (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Personas</TableHead>
                <TableHead>Products</TableHead>
                <TableHead>Winning</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {angles.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="text-sm font-medium">{a.name}</TableCell>
                  <TableCell className="max-w-xs truncate text-sm text-text2">
                    {a.description ?? '—'}
                  </TableCell>
                  <TableCell className="text-sm text-text2">
                    {a.personaNames.length > 0 ? a.personaNames.join(', ') : '—'}
                  </TableCell>
                  <TableCell className="text-sm text-text2">
                    {a.productNames.length > 0 ? a.productNames.join(', ') : '—'}
                  </TableCell>
                  <TableCell>
                    {a.winning ? (
                      <Badge variant="outline" className="border-ok text-ok">
                        Winning
                      </Badge>
                    ) : null}
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
