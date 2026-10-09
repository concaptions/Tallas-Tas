import { Badge } from '@tas/ui';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@tas/ui';

import { resolveClientBrand } from '@/lib/client-brand-source';
import { loadClientThemes } from '@/lib/client-data-source';

import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

interface Props {
  readonly params: Promise<{ brandSlug: string }>;
}

export default async function ClientThemesPage({ params }: Props) {
  const { brandSlug } = await params;
  const brand = await resolveClientBrand(brandSlug);
  if (!brand) notFound();

  const themesList = await loadClientThemes();

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-text">Themes</h1>
        <p className="text-sm text-text2">
          {themesList.length === 0
            ? 'No themes defined yet.'
            : `${String(themesList.length)} theme${themesList.length === 1 ? '' : 's'} in the global library`}
        </p>
      </div>

      {themesList.length > 0 && (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Active</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {themesList.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="text-sm font-medium">{t.name}</TableCell>
                  <TableCell className="text-sm text-text2">{t.category}</TableCell>
                  <TableCell>
                    {t.isActive ? (
                      <Badge variant="outline" className="border-ok text-ok">
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-text3">
                        Inactive
                      </Badge>
                    )}
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
