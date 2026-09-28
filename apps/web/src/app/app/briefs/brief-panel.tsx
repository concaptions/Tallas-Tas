'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { Button, StatusChip } from '@tas/ui';

import { EM_DASH, STANDALONE_CONCEPT_SLUG, type BriefItem } from './fields';

/**
 * The board's quick-look panel (P2B-3). Clicking a Kanban card opens this instead of leaving the
 * board, which is the whole point: a media buyer triaging a column wants to read one card without
 * losing the column. It is NOT a modal — fixed to the right edge, no backdrop, and the board behind
 * it stays visible and draggable, the same shape the Products and Personas panels take.
 *
 * It closes on Escape, on its close button, and on a pointer press outside it. A press on another
 * card is deliberately ignored here: that card's own click re-opens the panel for it, so the panel
 * SWITCHES records rather than closing and reopening.
 *
 * Everything is read-only. Editing a brief is a page's worth of material — the inherited block, the
 * approval rail, QA, spelling — which is what "Open full page" is for.
 */
interface BriefPanelProps {
  readonly item: BriefItem;
  readonly onClose: () => void;
  readonly onOpenFull: (item: BriefItem) => void;
}

/** One label/value row. A value the brief has not set reads as an em dash, never a blank. */
function Row({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-line py-2 last:border-b-0">
      <span className="text-xs text-text3">{label}</span>
      <span className="text-right text-sm text-text2">{children}</span>
    </div>
  );
}

export function BriefPanel({ item, onClose, onOpenFull }: BriefPanelProps) {
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
      if (target.closest('[data-slot="kanban-card"]') !== null) return;
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
      data-slot="brief-panel"
      aria-label={item.name}
      className="fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l border-line bg-surface shadow-lg min-[900px]:w-[400px]"
    >
      <header className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
        {/* Generated system output, so it stays font-mono exactly as the table and detail page show it. */}
        <p data-slot="brief-panel-title" className="font-mono text-xs break-all text-text">
          {item.name}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onClose}
          data-slot="brief-panel-close"
        >
          Close
        </Button>
      </header>

      <div className="flex flex-1 flex-col overflow-y-auto px-4 py-2">
        <Row label="Assignee">{item.assignee ?? <span className="text-text4">{EM_DASH}</span>}</Row>
        <Row label="Priority">
          {item.priority === null ? (
            <span className="text-text4">{EM_DASH}</span>
          ) : (
            <StatusChip tone={item.priority.tone} label={item.priority.label} />
          )}
        </Row>
        <Row label="Concept">{item.conceptName ?? STANDALONE_CONCEPT_SLUG}</Row>
        <Row label="Internal Status">
          <StatusChip tone={item.status.tone} label={item.status.label} />
        </Row>
        <Row label="Client Status">
          <StatusChip tone={item.clientStatus.tone} label={item.clientStatus.label} />
        </Row>
        <Row label="Type">{item.typeLabel}</Row>
        <Row label="Source">{item.sourceLabel}</Row>
        <Row label="Funnel">{item.funnelLabel}</Row>
      </div>

      <footer className="border-t border-line px-4 py-3">
        <Button
          type="button"
          size="sm"
          className="w-full"
          onClick={() => {
            onOpenFull(item);
          }}
          data-slot="brief-panel-open-full"
        >
          Open full page
        </Button>
      </footer>
    </aside>
  );
}
