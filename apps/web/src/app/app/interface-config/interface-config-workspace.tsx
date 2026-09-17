'use client';

import { useActionState, useCallback, useMemo, useState } from 'react';
import type { InterfacePageRow } from '@tas/db';
import { Button, DisabledWrite, disabledWriteClassName } from '@tas/ui';
import { enabledPages, toggleField, togglePage } from '@tas/domain/interface';

import { saveInterfaceConfigAction, type InterfaceConfigActionResult } from './actions';
import { ConfigPreview } from './config-preview';
import { ConfigTree } from './config-tree';
import {
  CONCEPT_CARD_PAGE_KEY,
  DEMO_DRAFT_NOTICE,
  NO_CONFIG_BODY,
  NO_CONFIG_TITLE,
  pageCountLabel,
  type ConceptPreview,
} from './fields';

/**
 * Interface Config (PRD §10): which pages the client sees, and which fields those pages show.
 *
 * THE WHOLE PAGE IS ONE DRAFT. The configuration loaded on the server seeds a piece of React state,
 * every switch rewrites that state through the PURE domain toggles, and both columns render from
 * it — so toggling a field removes it from the preview immediately, with no server round trip, no
 * navigation and no reload (ticket criteria 5 and 6), and the draft the Save control submits is
 * literally the configuration the CSM is looking at.
 *
 * NO RULE IS RESTATED HERE. `toggleField` and `togglePage` decide what a toggle does, `enabledPages`
 * and `visibleFields` decide what the client sees, and all four live in `@tas/domain/interface`
 * (CLAUDE.md: components never contain business logic). This component owns exactly two decisions
 * that are not rules — which tab is open, and whether the draft differs from what was loaded.
 *
 * IN DEMO MODE EVERY SWITCH STILL WORKS (criterion 13). The preview is the point of the page, and a
 * page whose switches did nothing would demonstrate nothing; it is SAVE that is disabled, through
 * `DisabledWrite` + `disabledWriteClassName` with the tooltip "Sign in required to save changes",
 * and the notice says the draft is not persisted. `saveInterfaceConfigAction` refuses again on the
 * server, before any validation, actor lookup or connection, so the disabled button is the courtesy
 * and the action is the guarantee.
 */
interface InterfaceConfigWorkspaceProps {
  readonly rows: readonly InterfacePageRow[];
  readonly demo: boolean;
  readonly concept: ConceptPreview | null;
}

/** The two flags of every row, as one comparable string: what "unsaved" means on this page. */
function flagsOf(pages: readonly InterfacePageRow[]): string {
  return pages
    .map(
      (page) =>
        `${page.id}:${String(page.enabled)}|${page.fields
          .map((field) => `${field.id}:${String(field.visible)}`)
          .join(',')}`,
    )
    .join(';');
}

export function InterfaceConfigWorkspace({ rows, demo, concept }: InterfaceConfigWorkspaceProps) {
  const [draft, setDraft] = useState<readonly InterfacePageRow[]>(rows);
  const [activeKey, setActiveKey] = useState<string>(CONCEPT_CARD_PAGE_KEY);
  const [state, formAction, pending] = useActionState<InterfaceConfigActionResult | null, FormData>(
    saveInterfaceConfigAction,
    null,
  );

  const onTogglePage = useCallback((pageKey: string) => {
    setDraft((current) => togglePage(current, pageKey));
  }, []);

  const onToggleField = useCallback((pageKey: string, fieldName: string) => {
    setDraft((current) => toggleField(current, pageKey, fieldName));
  }, []);

  /**
   * The empty card's way out: every hidden field of one page switched back on, applied one
   * `toggleField` at a time so the rule stays the domain's rather than being re-implemented as a
   * `visible: true` sweep.
   */
  const onShowEveryField = useCallback((pageKey: string) => {
    setDraft((current) => {
      const page = current.find((candidate) => candidate.pageKey === pageKey);
      if (page === undefined) {
        return current;
      }
      return page.fields
        .filter((field) => !field.visible)
        .reduce<readonly InterfacePageRow[]>(
          (config, field) => toggleField(config, pageKey, field.fieldName),
          current,
        );
    });
  }, []);

  const discard = useCallback(() => {
    setDraft(rows);
  }, [rows]);

  const dirty = flagsOf(draft) !== flagsOf(rows);

  /** The draft as the Server Action's `config` payload: the two flags, addressed by row id. */
  const payload = useMemo(
    () =>
      JSON.stringify({
        pages: draft.map((page) => ({
          id: page.id,
          pageKey: page.pageKey,
          enabled: page.enabled,
          fields: page.fields.map((field) => ({ id: field.id, visible: field.visible })),
        })),
      }),
    [draft],
  );

  const on = enabledPages(draft).length;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <p className="font-mono text-[11px] tracking-wide text-text3 uppercase">Settings</p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-text">Interface Config</h1>
          <form action={formAction} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="config" value={payload} />
            {dirty ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                data-slot="discard-changes"
                onClick={discard}
              >
                Discard changes
              </Button>
            ) : null}
            <DisabledWrite active={demo}>
              <Button
                type="submit"
                size="sm"
                data-slot="save-config"
                disabled={demo || pending || rows.length === 0}
                className={disabledWriteClassName}
              >
                {pending ? 'Saving…' : 'Save configuration'}
              </Button>
            </DisabledWrite>
          </form>
        </div>
        <p className="text-sm text-text2">
          <span data-slot="page-count">{pageCountLabel(on, draft.length)}</span> — what this
          brand&rsquo;s client sees when they sign in, at the two levels PRD §10 asks for: which
          pages appear, and which fields those pages show.
        </p>
        {demo ? (
          <p data-slot="demo-notice" className="text-sm text-text3">
            {DEMO_DRAFT_NOTICE}
          </p>
        ) : null}
        {state !== null && !state.ok ? (
          <p data-slot="save-error" className="text-sm text-bad">
            {state.error}
          </p>
        ) : null}
      </header>

      {rows.length === 0 ? (
        <section
          data-slot="config-empty"
          className="flex flex-col items-start gap-2 rounded-card border border-line bg-surface p-6"
        >
          <p className="text-sm font-medium text-text2">{NO_CONFIG_TITLE}</p>
          <p className="max-w-prose text-[13px] leading-relaxed text-text3">{NO_CONFIG_BODY}</p>
        </section>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <section
            data-slot="config-tree"
            aria-labelledby="config-tree-heading"
            className="flex flex-col gap-4 rounded-card border border-line bg-surface p-4"
          >
            <div className="flex flex-col gap-1">
              <h2 id="config-tree-heading" className="text-sm font-medium text-text2">
                Pages and fields
              </h2>
              <p className="text-[12px] leading-snug text-text3">
                Switch a page off and the client loses its tab and its card. Switch a field off and
                the card loses that line; the field keeps its place, so switching it back on
                restores the order.
              </p>
            </div>
            <ConfigTree pages={draft} onTogglePage={onTogglePage} onToggleField={onToggleField} />
          </section>

          <section
            data-slot="config-preview"
            aria-labelledby="config-preview-heading"
            className="flex flex-col gap-4 rounded-card border border-line bg-surface p-4"
          >
            <div className="flex flex-col gap-1">
              <h2 id="config-preview-heading" className="text-sm font-medium text-text2">
                What the client sees
              </h2>
              <p className="text-[12px] leading-snug text-text3">
                The client interface in miniature, rendered from this draft. Read only — nothing on
                this side writes anything.
              </p>
            </div>
            <ConfigPreview
              pages={draft}
              activeKey={activeKey}
              concept={concept}
              onSelect={setActiveKey}
              onShowEveryField={onShowEveryField}
            />
          </section>
        </div>
      )}
    </div>
  );
}
