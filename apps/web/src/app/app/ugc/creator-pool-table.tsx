'use client';

import { useCallback, useState, useTransition } from 'react';
import { Button, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@tas/ui';
import { ageBracketLabel, creatorPlatformLabel } from '@tas/domain/creators';

import { EM_DASH, REGISTRY_POOL_COLUMNS, type RegistryCreatorCardRow } from './fields';
import { addRegistryCreatorToBrandAction } from './registry-actions';

interface CreatorPoolTableProps {
  readonly rows: readonly RegistryCreatorCardRow[];
  readonly demo: boolean;
}

export function CreatorPoolTable({ rows, demo }: CreatorPoolTableProps) {
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();

  const addToBrand = useCallback((id: string) => {
    startTransition(async () => {
      const result = await addRegistryCreatorToBrandAction(id);
      if (result.ok) {
        setAddedIds((prev) => new Set([...prev, id]));
      }
    });
  }, []);

  return (
    <div className="overflow-x-auto rounded-card border border-line">
      <Table>
        <TableHeader>
          <TableRow>
            {REGISTRY_POOL_COLUMNS.map((col) => (
              <TableHead key={col} className="whitespace-nowrap text-xs">
                {col}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id} data-registry-id={row.id}>
              <TableCell className="font-medium">{row.name}</TableCell>
              <TableCell className="font-mono text-xs">
                {row.instagramUsername ?? EM_DASH}
              </TableCell>
              <TableCell className="text-sm">{row.gender ?? EM_DASH}</TableCell>
              <TableCell className="text-sm">
                {row.ageBracket === null ? EM_DASH : ageBracketLabel(row.ageBracket)}
              </TableCell>
              <TableCell className="text-sm">{row.ethnicity ?? EM_DASH}</TableCell>
              <TableCell className="text-sm">{row.shippingLocation ?? EM_DASH}</TableCell>
              <TableCell className="text-sm">
                {row.platform.length === 0
                  ? creatorPlatformLabel(null)
                  : row.platform.map((p) => creatorPlatformLabel(p)).join(', ')}
              </TableCell>
              <TableCell className="text-center text-sm">{String(row.totalBrands)}</TableCell>
              <TableCell>
                {addedIds.has(row.id) ? (
                  <span className="text-xs text-ok">Added</span>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={demo || pending}
                    onClick={() => {
                      addToBrand(row.id);
                    }}
                    data-slot="add-to-brand"
                  >
                    Add to Brand
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
