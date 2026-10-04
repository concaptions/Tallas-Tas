'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import Link from 'next/link';
import { Button, StatusChip } from '@tas/ui';

import { EM_DASH, NAME_PART_LABELS, type ConceptItem } from './fields';

/**
 * The Concepts quick-look panel (AI-17, the operator's ruling): a row click opens THIS instead of
 * leaving the list — the shipped brief-panel pattern, because someone scanning the pipeline wants
 * to read one concept without losing their place, their search and their view. It is NOT a modal:
 * fixed to the right edge, no backdrop, the list behind it stays visible and clickable.
 *
 * It closes on Escape, on its close button, and on a pointer press outside it. A press on another
 * row, card or list row is deliberately ignored here: that record's own click re-opens the panel
 * for it, so the panel SWITCHES concepts rather than closing and reopening.
 *
 * Everything is read-only — the row data the list already loaded, no second query. The full page
 * (pairing, inherited block, approval rail) is one navigation away, and the generated NAME is that
 * navigation: a real <Link> (AI-52), so it can be cmd-clicked, middle-clicked and copied.
 */
interface ConceptPanelProps {
  readonly item: ConceptItem;
  readonly onClose: () => void;
}

/** One label/value row. A value the concept has not set reads as an em dash, never a blank. */
function Row({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-line py-2 last:border-b-0">
      <span className="text-xs text-text3">{label}</span>
      <span className="text-right text-sm text-text2">{children}</span>
    </div>
  );
}

const DASH = <span className="text-text4">{EM_DASH}</span>;

export function ConceptPanel({ item, onClose }: ConceptPanelProps) {
  const panelRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (panelRef.current?.contains(target) === true) return;
      if (
        target.closest(
          '[data-slot="concept-row"], [data-slot="concept-card"], [data-slot="concept-list-row"]',
        ) !== null
      ) {
        return;
      }
      onClose();
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [onClose]);

  return (
    <aside
      ref={panelRef}
      data-slot="concept-panel"
      aria-label={item.name}
      className="fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l border-line bg-surface shadow-lg min-[900px]:w-[400px]"
    >
      <header className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
        {/*
          Generated system output, so it stays font-mono — and it IS the link to the full page
          (AI-52): a real anchor the reader can cmd-click, middle-click or copy, never a button
          that calls router.push.
        */}
        <Link
          href={item.href}
          data-slot="concept-panel-name"
          className="font-mono text-xs break-all text-text hover:underline"
        >
          {item.name}
        </Link>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onClose}
          data-slot="concept-panel-close"
        >
          Close
        </Button>
      </header>

      <div className="flex flex-1 flex-col overflow-y-auto px-4 py-2">
        {/* The three parts the name is generated from, under the labels the detail page uses. */}
        <Row label={NAME_PART_LABELS.batch}>
          {item.batch === null ? DASH : <span className="font-mono text-xs">{item.batch}</span>}
        </Row>
        <Row label={NAME_PART_LABELS.angleName}>{item.angleName ?? DASH}</Row>
        <Row label={NAME_PART_LABELS.themeName}>{item.themeName ?? DASH}</Row>
        {/* Inherited THROUGH the angle, exactly as the list column shows it. */}
        <Row label="Product">{item.productName ?? DASH}</Row>
        {/* The two tracks of CLAUDE.md non-negotiable 4, as the one StatusChip primitive. */}
        <Row label="Internal Status">
          <StatusChip tone={item.status.tone} label={item.status.label} />
        </Row>
        <Row label="Client Status">
          <StatusChip tone={item.clientStatus.tone} label={item.clientStatus.label} />
        </Row>
      </div>

      <footer className="border-t border-line px-4 py-3">
        {/* The same navigation as the name, for the reader whose eye is at the bottom of the panel. */}
        <Button asChild size="sm" className="w-full">
          <Link href={item.href} data-slot="concept-panel-open-full">
            Open full page
          </Link>
        </Button>
      </footer>
    </aside>
  );
}
