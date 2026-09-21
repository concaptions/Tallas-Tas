'use client';

import { startTransition, useActionState } from 'react';
import { Button, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@tas/ui';

import { propagateAllAction, type PropagateActionResult } from './propagate-actions';

export interface ChildBrandItem {
  readonly id: string;
  readonly name: string;
  readonly status: string;
}

interface PropagationControlsProps {
  readonly childBrands: readonly ChildBrandItem[];
  readonly demo: boolean;
}

export function PropagationControls({ childBrands, demo }: PropagationControlsProps) {
  // eslint-disable-next-line @typescript-eslint/no-invalid-void-type -- React useActionState requires void for no-payload actions
  const [result, action, propagating] = useActionState<PropagateActionResult | null, void>(
    propagateAllAction,
    null,
  );

  function handlePropagate() {
    startTransition(() => {
      action();
    });
  }

  const success = result !== null && result.ok ? result : null;
  const error = result !== null && !result.ok ? result.error : null;

  return (
    <section aria-labelledby="propagation-controls-heading" className="flex min-w-0 flex-col gap-3">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
        <h2 id="propagation-controls-heading" className="text-sm font-medium text-text2">
          Template Propagation
        </h2>
        {!demo && (
          <Button size="sm" variant="outline" onClick={handlePropagate} disabled={propagating}>
            {propagating ? 'Propagating…' : 'Propagate All'}
          </Button>
        )}
      </div>

      <p className="text-xs text-text4">
        Push all template content and interface configuration to every child brand. Fields that a
        child has overridden are preserved.
      </p>

      {error !== null && (
        <p data-slot="propagate-error" className="text-sm text-bad">
          {error}
        </p>
      )}

      {success !== null && (
        <p data-slot="propagate-success" className="text-sm text-ok">
          Propagated to {success.content.childrenUpdated} brand
          {success.content.childrenUpdated === 1 ? '' : 's'} — {success.content.rowsCopied} content
          row{success.content.rowsCopied === 1 ? '' : 's'} synced, {success.interface.pagesPerChild}{' '}
          page{success.interface.pagesPerChild === 1 ? '' : 's'} and{' '}
          {success.interface.fieldsPerChild} field
          {success.interface.fieldsPerChild === 1 ? '' : 's'} per child.
        </p>
      )}

      <div className="rounded-card border border-line">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Child Brand</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {childBrands.length === 0 ? (
              <TableRow>
                <TableCell colSpan={2} className="text-center text-sm text-text3">
                  No child brands yet. Onboard a brand to see it here.
                </TableCell>
              </TableRow>
            ) : (
              childBrands.map((brand) => (
                <TableRow key={brand.id}>
                  <TableCell className="text-sm font-medium">{brand.name}</TableCell>
                  <TableCell className="font-mono text-xs text-text3">{brand.status}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
