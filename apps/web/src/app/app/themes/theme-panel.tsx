'use client';

import { useEffect } from 'react';
import { Button } from '@tas/ui';

import { ThemeCard } from './theme-card';
import type { ThemeCardRow } from './fields';

interface ThemePanelProps {
  readonly theme: ThemeCardRow;
  readonly demo: boolean;
  readonly onClose: () => void;
  readonly onToggled: () => void;
}

/**
 * The Themes side panel: a grid row opens it, exactly as a Products or Angles row opens theirs.
 * NOT a modal — fixed to the right edge, the grid stays visible and clickable beside it, no
 * backdrop, Escape closes it. The body is the existing `ThemeCard`, unchanged: every Gratsi stored
 * field under its own label and the Archive / Restore form, so the card remains the one place a
 * theme's full record and its only write live (the module-parity spec reads the labels here).
 */
export function ThemePanel({ theme, demo, onClose, onToggled }: ThemePanelProps) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <aside
      data-slot="theme-panel"
      aria-label={`Theme: ${theme.name}`}
      className="fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l border-line bg-surface shadow-lg min-[900px]:w-[480px]"
    >
      <header className="flex items-start justify-between gap-3 border-b border-line px-4 py-3 sm:px-6">
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="font-mono text-[11px] tracking-wide text-text3 uppercase">Theme</p>
          <h2 className="truncate text-lg font-semibold text-text" data-slot="theme-panel-title">
            {theme.name}
          </h2>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClose}
          aria-label="Close panel"
          data-slot="theme-panel-close"
        >
          Close
        </Button>
      </header>
      <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
        <ThemeCard theme={theme} demo={demo} onToggled={onToggled} />
      </div>
    </aside>
  );
}
