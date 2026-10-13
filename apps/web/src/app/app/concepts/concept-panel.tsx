'use client';

import Link from 'next/link';
import { Button } from '@tas/ui';

import { ReadOnlyFields, RecordSheet, type RecordSheetNavigation } from '@/components/views';
import type { GridColumn } from '@/components/views/airtable-grid';

import { type ConceptItem } from './fields';

/**
 * The Concepts quick-look sidebar (Ticket 9, part 3): a row click opens THIS, built on the shared
 * `RecordSheet` — header with counter + prev/next, ArrowLeft / ArrowRight through the grid-visible
 * set, close through its built-in button and overlay dismiss. The body is `ReadOnlyFields` over the
 * same `GridColumn` list the grid draws, so every stored column is on screen under its resolved
 * header, in the resolved order, without a second column loop in this file. "Open full page" is a
 * right-click menu action on the grid; the sidebar's own footer links there too for the reader
 * whose eye is at the bottom of the panel.
 *
 * The generated name is the panel's heading — font-mono (CLAUDE.md non-negotiable 6) and a real
 * `<Link>` so it can be cmd-clicked, middle-clicked and copied (AI-52). It carries the
 * `concept-panel-name` slot that the e2e asserts against.
 */
interface ConceptPanelProps {
  readonly item: ConceptItem;
  readonly columns: readonly GridColumn<ConceptItem>[];
  readonly onClose: () => void;
  /** The sidebar's prev/next walk through the grid-visible set (sort + group aware). */
  readonly nav?: RecordSheetNavigation;
  readonly onNavigate?: (id: string) => void;
}

export function ConceptPanel({ item, columns, onClose, nav, onNavigate }: ConceptPanelProps) {
  return (
    <RecordSheet
      open
      onClose={onClose}
      nav={nav}
      onNavigate={onNavigate}
      title={item.name}
      titleSlot="concept-panel-title"
      description={item.name}
      width="record"
    >
      <div className="flex flex-col gap-4">
        <Link
          href={item.href}
          data-slot="concept-panel-name"
          className="font-mono text-xs break-all text-text hover:underline"
        >
          {item.name}
        </Link>

        {/*
          Every stored column the grid draws, in the resolver's order, except `name` — which is
          already the panel's heading above and would otherwise read twice.
        */}
        <ReadOnlyFields columns={columns} row={item} slot="concept-field" except={['name']} />

        <Button asChild size="sm" className="w-full">
          <Link href={item.href} data-slot="concept-panel-open-full">
            Open full page
          </Link>
        </Button>
      </div>
    </RecordSheet>
  );
}
