'use client';

import { useActionState, useState, useTransition } from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DisabledWrite,
  Switch,
  disabledWriteClassName,
} from '@tas/ui';
import type { PageKind } from '@tas/domain';

import {
  requestCustomPagePromotionAction,
  type CustomPagePromotionActionResult,
} from './custom-page-propagation-actions';
import {
  PAGE_KIND_LABELS,
  PAGES_SECTION_BODY,
  PAGES_SECTION_TITLE,
  PUSH_DIALOG_BODY,
  PUSH_DIALOG_TITLE,
} from './fields';
import {
  reorderPageAction,
  resetPageAction,
  setPageVisibilityAction,
  type PageActionResult,
} from './page-actions';

/** One page of the brand as the section lists it, projected on the server from the merged rows. */
export interface PageListItem {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly kind: PageKind;
  readonly isVisible: boolean;
  /** The brand has its own row for this slug (visibility or order of its own). */
  readonly overridden: boolean;
  /** A template row: the one kind an Admin may push to every client. */
  readonly isTemplate: boolean;
}

interface PagesSectionProps {
  readonly pages: readonly PageListItem[];
  readonly demo: boolean;
  /** Admin + CSM may toggle and reorder; false for anyone else. */
  readonly disabled: boolean;
  /** Admin only: the push to every client (Talal, answer 3). */
  readonly canPush: boolean;
}

/**
 * The "Pages" section of Interface Config (Scope A, B4): every page of the brand — standard tab,
 * custom view, module page — in the brand's order, with a visibility switch, a step up / down, a
 * reset for a brand override, and, on a template row for an Admin, "Push to all clients", which
 * opens a REVIEW request (B3) rather than writing anything.
 *
 * NO BUSINESS LOGIC HERE: the merge is `mergeCustomPages` / `listMergedPages`, the move rule is
 * `movePage`, and the actions decide what writes succeed. `PageRow` is hook-free so a test can
 * drive it as a function; this wrapper owns the action state and the dialog.
 */
export function PagesSection({ pages, demo, disabled, canPush }: PagesSectionProps) {
  const [toggleState, toggleAction, togglePending] = useActionState<
    PageActionResult | null,
    FormData
  >(setPageVisibilityAction, null);
  const [, reorderAction, reorderPending] = useActionState<PageActionResult | null, FormData>(
    reorderPageAction,
    null,
  );
  const [, resetAction, resetPending] = useActionState<PageActionResult | null, FormData>(
    resetPageAction,
    null,
  );
  const [pushState, pushAction, pushPending] = useActionState<
    CustomPagePromotionActionResult | null,
    FormData
  >(requestCustomPagePromotionAction, null);
  const [, startTransition] = useTransition();
  const [pushing, setPushing] = useState<PageListItem | null>(null);
  const pending = togglePending || reorderPending || resetPending || pushPending;

  const submit = (action: (fd: FormData) => void, entries: Record<string, string>) => {
    const fd = new FormData();
    for (const [key, value] of Object.entries(entries)) fd.append(key, value);
    startTransition(() => {
      action(fd);
    });
  };

  return (
    <section
      data-slot="pages-section"
      aria-labelledby="pages-heading"
      className="flex flex-col gap-4 rounded-card border border-line bg-surface p-4"
    >
      <div className="flex flex-col gap-1">
        <h2 id="pages-heading" className="text-sm font-medium text-text2">
          {PAGES_SECTION_TITLE}
        </h2>
        <p className="text-[12px] leading-snug text-text3">{PAGES_SECTION_BODY}</p>
      </div>
      <ul className="flex flex-col gap-1" data-slot="pages-list">
        {pages.map((page, index) => (
          <PageRow
            key={page.slug}
            page={page}
            canMoveUp={index > 0}
            canMoveDown={index < pages.length - 1}
            demo={demo}
            disabled={disabled || pending}
            canPush={canPush}
            onToggle={(slug, isVisible) => {
              submit(toggleAction, { slug, isVisible: String(isVisible) });
            }}
            onMove={(slug, direction) => {
              submit(reorderAction, { slug, direction });
            }}
            onReset={(slug) => {
              submit(resetAction, { slug });
            }}
            onPush={setPushing}
          />
        ))}
      </ul>
      {toggleState !== null && !toggleState.ok ? (
        <p data-slot="pages-error" className="text-xs text-bad" role="alert">
          {toggleState.error}
        </p>
      ) : null}
      {pushState !== null && !pushState.ok ? (
        <p data-slot="pages-push-error" className="text-xs text-bad" role="alert">
          {pushState.error}
        </p>
      ) : null}
      {pushState !== null && pushState.ok ? (
        <p data-slot="pages-pushed" className="text-xs text-ok" role="status">
          Sent to the Propagation page for an Admin to approve.
        </p>
      ) : null}
      <PushReviewDialog
        page={pushing}
        pending={pushPending}
        onClose={() => {
          setPushing(null);
        }}
        onConfirm={(page) => {
          submit(pushAction, { id: page.id });
          setPushing(null);
        }}
      />
    </section>
  );
}

export interface PageRowProps {
  readonly page: PageListItem;
  readonly canMoveUp: boolean;
  readonly canMoveDown: boolean;
  readonly demo: boolean;
  readonly disabled: boolean;
  readonly canPush: boolean;
  /** Called SYNCHRONOUSLY with the slug and the NEXT visibility on a switch. */
  readonly onToggle: (slug: string, isVisible: boolean) => void;
  readonly onMove: (slug: string, direction: 'up' | 'down') => void;
  readonly onReset: (slug: string) => void;
  /** Opens the review dialog; nothing is written until it is confirmed. */
  readonly onPush: (page: PageListItem) => void;
}

/** One page row. Hook-free: every control calls straight out, so a test can drive it as a function. */
export function PageRow({
  page,
  canMoveUp,
  canMoveDown,
  demo,
  disabled,
  canPush,
  onToggle,
  onMove,
  onReset,
  onPush,
}: PageRowProps) {
  const inert = demo || disabled;
  return (
    <li
      className="flex flex-wrap items-center justify-between gap-3 rounded-input border border-line bg-surface2 px-3 py-2"
      data-slot="page-row"
      data-page-slug={page.slug}
      data-page-kind={page.kind}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <DisabledWrite active={inert}>
          <Switch
            data-slot="page-visibility-switch"
            data-page-slug={page.slug}
            checked={page.isVisible}
            disabled={inert}
            onCheckedChange={(checked) => {
              onToggle(page.slug, checked);
            }}
            className={disabledWriteClassName}
            aria-label={`Show ${page.title}`}
          />
        </DisabledWrite>
        <span className="text-sm text-text">{page.title}</span>
        <span className="font-mono text-[10px] tracking-wide text-text3 uppercase">
          {PAGE_KIND_LABELS[page.kind]}
        </span>
        <span
          data-slot="page-inheritance"
          className={`font-mono text-[10px] tracking-wide uppercase ${page.overridden ? 'text-text3' : 'text-text4'}`}
        >
          {page.overridden ? 'overridden' : 'inherited'}
        </span>
      </div>
      <div className="flex items-center gap-1">
        {(['up', 'down'] as const).map((direction) => {
          const movable = direction === 'up' ? canMoveUp : canMoveDown;
          return (
            <DisabledWrite key={direction} active={inert}>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                data-slot="page-move"
                data-direction={direction}
                data-page-slug={page.slug}
                disabled={!movable || inert}
                onClick={() => {
                  onMove(page.slug, direction);
                }}
                className={disabledWriteClassName}
                aria-label={`Move ${page.title} ${direction}`}
              >
                {direction === 'up' ? '↑' : '↓'}
              </Button>
            </DisabledWrite>
          );
        })}
        {page.overridden ? (
          <DisabledWrite active={inert}>
            <Button
              type="button"
              variant="outline"
              size="sm"
              data-slot="page-reset"
              data-page-slug={page.slug}
              disabled={inert}
              onClick={() => {
                onReset(page.slug);
              }}
              className={disabledWriteClassName}
            >
              Reset
            </Button>
          </DisabledWrite>
        ) : null}
        {page.isTemplate && canPush ? (
          <DisabledWrite active={inert}>
            <Button
              type="button"
              variant="outline"
              size="sm"
              data-slot="page-push"
              data-page-slug={page.slug}
              disabled={inert}
              onClick={() => {
                onPush(page);
              }}
              className={disabledWriteClassName}
            >
              Push to all clients
            </Button>
          </DisabledWrite>
        ) : null}
      </div>
    </li>
  );
}

export interface PushReviewDialogProps {
  readonly page: PageListItem | null;
  readonly pending: boolean;
  readonly onClose: () => void;
  readonly onConfirm: (page: PageListItem) => void;
}

/** The confirmation before a push request is opened: it names the page and what approval does. */
export function PushReviewDialog({ page, pending, onClose, onConfirm }: PushReviewDialogProps) {
  return (
    <Dialog
      open={page !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent data-slot="page-push-dialog" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{PUSH_DIALOG_TITLE}</DialogTitle>
          <DialogDescription>
            {page === null ? '' : `"${page.title}" — ${PUSH_DIALOG_BODY}`}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            data-slot="page-push-confirm"
            disabled={pending || page === null}
            onClick={() => {
              if (page !== null) onConfirm(page);
            }}
          >
            Open review request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
