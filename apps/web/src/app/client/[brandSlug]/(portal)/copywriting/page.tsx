import { notFound } from 'next/navigation';
import { copyTitle } from '@tas/domain/copy';
import { copyStatusLabel, copyStatusTone } from '@tas/domain/state';
import { StatusChip, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@tas/ui';

import { resolveClientBrand } from '@/lib/client-brand-source';
import { loadClientCopywriting } from '@/lib/client-data-source';

export const dynamic = 'force-dynamic';

interface Props {
  readonly params: Promise<{ brandSlug: string }>;
}

/**
 * The client portal's Copywriting tab (PRD §9 "Copywriting | Status, Client's Comment"). The tab
 * key, label and `loadClientCopywriting` shipped with the interface config on 2026-10-06; this
 * page did not, so the tab 404'd until 2026-10-09. Same shape as the Creative Sheet and Concepts
 * pages: the brand resolved from the slug, the allowlisted client query, a table, status chips
 * from the domain. Copy has ONE status track and it is already client-facing (`COPY_STATUS`), so
 * there is no internal/client gate to apply here; `clientCopywriting` returns only the allowlisted
 * columns (never the internal cost or platform fields — `client-queries.test.ts`).
 */
export default async function ClientCopywritingPage({ params }: Props) {
  const { brandSlug } = await params;
  const brand = await resolveClientBrand(brandSlug);
  if (!brand) notFound();

  const copies = await loadClientCopywriting(brand.id);

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-text">Copywriting</h1>
        <p className="text-sm text-text2">
          {copies.length === 0
            ? 'No copy ready for review.'
            : `${String(copies.length)} ${copies.length === 1 ? 'copy' : 'copies'}`}
        </p>
      </div>

      {copies.length > 0 && (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Copy</TableHead>
                <TableHead>Headline</TableHead>
                <TableHead>Primary copy</TableHead>
                <TableHead>CTA</TableHead>
                <TableHead>Funnel</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Your comment</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {copies.map((copy) => (
                <TableRow key={copy.id} data-slot="client-copy-row">
                  <TableCell className="font-mono text-sm">{copyTitle(copy.copyNumber)}</TableCell>
                  <TableCell className="text-sm text-text">{copy.headline ?? '—'}</TableCell>
                  <TableCell className="max-w-md text-sm text-text2">
                    <span className="line-clamp-3">{copy.primaryCopy ?? '—'}</span>
                  </TableCell>
                  <TableCell className="text-sm text-text2">{copy.cta}</TableCell>
                  <TableCell className="text-sm text-text2">{copy.funnel ?? '—'}</TableCell>
                  <TableCell>
                    <StatusChip
                      label={copyStatusLabel(copy.status)}
                      tone={copyStatusTone(copy.status)}
                    />
                  </TableCell>
                  <TableCell className="max-w-xs text-sm text-text2">
                    {copy.clientComment ?? '—'}
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
