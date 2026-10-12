'use client';

import { useCallback, useEffect, useMemo, useState, useTransition, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { briefThumbnail } from '@tas/domain/creatives';
import {
  Button,
  DEMO_WRITE_HINT,
  DisabledWrite,
  disabledWriteClassName,
  StatusChip,
  Textarea,
} from '@tas/ui';

import { toggleQaAction } from '@/app/app/creative-design/actions';
import { briefPath } from '@/lib/routes';

import type { SheetItemView } from './creative-sheet-workspace';
import { EM_DASH, internalStatusView, statusView } from './fields';
import {
  focusActions,
  focusCounter,
  focusIndex,
  focusQaChecklist,
  focusQaProgress,
  neighbourIndex,
  QA_GATE_NOTE,
} from './focus-mode';
import {
  approveCreativeAction,
  postCreativeCommentAction,
  requestChangesAction,
  submitToClientAction,
  type ReviewResult,
} from './review-actions';
import { SheetIcon } from './sheet-icons';

/**
 * Focus Mode (Oct 12 scope 1): the Creative Sheet's third view — one creative at a time, full
 * width, with prev / next over the rows the search left on screen. The bar carries the generated
 * name, both status chips and the three review buttons; the left column the identity, the two
 * tracks and the QA checklist FILTERED BY TYPE (a video never shows Graphic Designer QA); the
 * right column the asset preview, the brief's content and the Feedback thread.
 *
 * Every button's state comes from `focus-mode.ts`, which asks the same guard the Server Actions
 * re-run, so a disabled button carries the action's own refusal as its tooltip and an enabled one
 * cannot be refused for a reason the page already knew. The creative in focus lives in the same
 * `?creative-sheet=` parameter the sidebar uses, so a refresh keeps the place.
 */
interface FocusModeViewProps {
  readonly items: readonly SheetItemView[];
  readonly focusedId: string | null;
  readonly onFocus: (id: string) => void;
  readonly demo: boolean;
}

const SECTION_LABEL = 'text-[10px] font-semibold tracking-[.09em] text-text4 uppercase';

function Row({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1">
      <span className="shrink-0 text-xs text-text3">{label}</span>
      <span className="min-w-0 text-right text-xs leading-relaxed text-text2">{children}</span>
    </div>
  );
}

function Dash() {
  return <span className="text-text4">{EM_DASH}</span>;
}

function TextCard({
  title,
  children,
  className,
  action,
}: {
  readonly title: string;
  readonly children: ReactNode;
  readonly className?: string;
  readonly action?: ReactNode;
}) {
  return (
    <section
      className={`flex min-w-0 flex-col overflow-hidden rounded-card border border-line bg-surface ${className ?? ''}`}
    >
      <header className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
        <h3 className={SECTION_LABEL}>{title}</h3>
        {action}
      </header>
      <div className="px-3 py-2.5 text-xs leading-relaxed whitespace-pre-wrap text-text2">
        {children}
      </div>
    </section>
  );
}

/** The first attachment that is plainly an image, for the preview; attachments are URLs here. */
function firstImage(urls: readonly string[] | null | undefined): string | null {
  return (
    (urls ?? []).find(
      (url) =>
        /^https?:\/\/.+\.(png|jpe?g|gif|webp|avif)(\?.*)?$/i.test(url) ||
        /picsum\.photos/.test(url),
    ) ?? null
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter((part) => part !== '')
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

export function FocusModeView({ items, focusedId, onFocus, demo }: FocusModeViewProps) {
  const router = useRouter();
  const ids = useMemo(() => items.map((view) => view.item.id), [items]);
  const index = focusIndex(ids, focusedId);
  const view = index === -1 ? null : (items[index] ?? null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [posted, setPosted] = useState<
    readonly { id: string; authorName: string; body: string; at: string }[]
  >([]);
  const [draft, setDraft] = useState('');

  // The comments the page loaded plus the ones posted since, until the refresh brings them back.
  useEffect(() => {
    setPosted([]);
    setDraft('');
    setError(null);
  }, [view?.item.id]);

  const go = useCallback(
    (delta: number) => {
      const next = neighbourIndex(index, delta, ids.length);
      const id = ids[next];
      if (id !== undefined && id !== focusedId) onFocus(id);
    },
    [focusedId, ids, index, onFocus],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        target.closest('input, textarea, select, [contenteditable]') !== null
      )
        return;
      if (event.key === 'ArrowLeft') go(-1);
      if (event.key === 'ArrowRight') go(1);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [go]);

  const run = (action: (id: string) => Promise<ReviewResult>) => {
    if (view === null || demo) return;
    setError(null);
    startTransition(async () => {
      const result = await action(view.item.id);
      if (result.ok) router.refresh();
      else setError(result.error);
    });
  };

  const tick = (check: 'qaVideoEditor' | 'qaDesigner' | 'qaStrategist', next: boolean) => {
    if (view === null || demo) return;
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set('id', view.item.id);
      formData.set('check', check);
      formData.set('checked', String(next));
      const result = await toggleQaAction(null, formData);
      if (result.ok) router.refresh();
      else setError(result.error);
    });
  };

  const post = () => {
    if (view === null || demo || draft.trim() === '') return;
    setError(null);
    startTransition(async () => {
      const result = await postCreativeCommentAction(view.item.id, draft);
      if (result.ok) {
        setPosted((current) => [
          ...current,
          { id: result.id, authorName: result.authorName, body: result.body, at: 'just now' },
        ]);
        setDraft('');
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  };

  if (view === null) {
    return (
      <div
        data-slot="focus-empty"
        className="rounded-card border border-line bg-surface px-4 py-10 text-center text-sm text-text2"
      >
        Nothing to focus on. Add a creative, or clear the search.
      </div>
    );
  }

  const { item, lookups, comments } = view;
  const detail = item.detail;
  const internal = internalStatusView(item.internalStatus);
  const client = statusView(item.status);
  const actions = focusActions(item);
  const checklist = focusQaChecklist(item);
  const image = firstImage(detail.designFile) ?? firstImage(detail.inspirationImage);
  const tile = briefThumbnail({
    name: item.briefName ?? item.name,
    designFileUrl: item.briefDesignFileUrl,
    inspoLinks: detail.inspoLinks,
  });
  const allComments = [
    ...comments.map((comment) => ({
      id: comment.id,
      authorName: comment.authorName,
      body: comment.body,
      at: `${comment.at} · ${comment.ago}`,
    })),
    ...posted,
  ];

  const button = (
    label: string,
    icon: ReactNode,
    state: { enabled: boolean; hint: string | null },
    onClick: () => void,
    slot: string,
    variant: 'outline' | 'default' | 'secondary',
    extraClass = '',
  ) => {
    const disabled = demo || pending || !state.enabled;
    const hint = demo ? DEMO_WRITE_HINT : (state.hint ?? '');
    return (
      <DisabledWrite active={disabled && hint !== ''} hint={hint}>
        <Button
          type="button"
          size="sm"
          variant={variant}
          disabled={disabled}
          onClick={onClick}
          data-slot={slot}
          title={hint === '' ? undefined : hint}
          className={`${disabled ? disabledWriteClassName : ''} ${extraClass}`}
        >
          {icon}
          {label}
        </Button>
      </DisabledWrite>
    );
  };

  return (
    <div
      data-slot="focus-mode"
      data-focus-id={item.id}
      className="flex flex-col overflow-hidden rounded-card border border-line bg-bg"
    >
      {/* Focus bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface px-4 py-3">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <div className="flex items-center gap-0.5 rounded-input border border-line bg-surface2 p-0.5">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="size-7"
              aria-label="Previous creative"
              data-slot="focus-prev"
              disabled={index <= 0}
              onClick={() => {
                go(-1);
              }}
            >
              <SheetIcon name="prev" />
            </Button>
            <span
              data-slot="focus-counter"
              className="px-2 font-mono text-[11px] text-text3 tabular-nums"
            >
              {focusCounter(index, ids.length)}
            </span>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="size-7"
              aria-label="Next creative"
              data-slot="focus-next"
              disabled={index >= ids.length - 1}
              onClick={() => {
                go(1);
              }}
            >
              <SheetIcon name="next" />
            </Button>
          </div>
          <span className="hidden h-5 w-px bg-line sm:block" />
          <span data-slot="focus-name" className="truncate font-mono text-sm font-medium text-text">
            {item.briefName ?? item.name}
          </span>
          {internal === null ? null : <StatusChip tone={internal.tone} label={internal.label} />}
          {client === null ? null : <StatusChip tone={client.tone} label={client.label} />}
        </div>
        <div className="flex flex-wrap items-center gap-2" data-slot="focus-actions">
          {button(
            'Request Changes',
            <SheetIcon name="x" />,
            actions.requestChanges,
            () => {
              run(requestChangesAction);
            },
            'focus-request-changes',
            'outline',
            'text-bad border-bad/45 hover:text-bad',
          )}
          {button(
            'Approve',
            <SheetIcon name="check" />,
            actions.approve,
            () => {
              run(approveCreativeAction);
            },
            'focus-approve',
            'secondary',
            'text-ok',
          )}
          {button(
            'Submit to Client',
            <SheetIcon name="lock" />,
            actions.submitToClient,
            () => {
              run(submitToClientAction);
            },
            'focus-submit',
            'default',
          )}
        </div>
      </div>
      {error === null ? null : (
        <p
          role="alert"
          data-slot="focus-error"
          className="border-b border-line bg-surface px-4 py-2 text-xs text-bad"
        >
          {error}
        </p>
      )}

      <div className="grid gap-0 lg:grid-cols-[300px_minmax(0,1fr)]">
        {/* Left: metadata */}
        <aside
          className="flex flex-col border-b border-line bg-surface lg:border-r lg:border-b-0"
          data-slot="focus-meta"
        >
          <section className="border-b border-line px-4 py-3">
            <h3 className={`${SECTION_LABEL} mb-2`}>Identity</h3>
            <Row label="Concept">{lookups.concept ?? <Dash />}</Row>
            <Row label="Angle">{lookups.angle ?? <Dash />}</Row>
            <Row label="Batch">
              <span className="font-mono">{detail.batch ?? EM_DASH}</span>
            </Row>
            <Row label="Type">
              {item.briefType === null ? (
                <Dash />
              ) : (
                <StatusChip tone="mute" label={item.briefType} />
              )}
            </Row>
            <Row label="Source">{detail.source}</Row>
            <Row label="Funnel">{item.briefFunnel ?? <Dash />}</Row>
          </section>
          <section className="border-b border-line px-4 py-3">
            <h3 className={`${SECTION_LABEL} mb-2`}>Status</h3>
            <Row label="Internal">
              {internal === null ? (
                <Dash />
              ) : (
                <StatusChip tone={internal.tone} label={internal.label} />
              )}
            </Row>
            <Row label="Client">
              {client === null ? <Dash /> : <StatusChip tone={client.tone} label={client.label} />}
            </Row>
            <Row label="Due date">
              {detail.dueDate === null ? (
                <Dash />
              ) : (
                <span className="font-mono">{detail.dueDate.toISOString().slice(0, 10)}</span>
              )}
            </Row>
            <Row label="Assignee">{detail.assignee ?? <Dash />}</Row>
          </section>
          <section className="px-4 py-3" data-slot="focus-qa">
            <h3 className={`${SECTION_LABEL} mb-2`}>QA Checklist</h3>
            <ul className="flex flex-col gap-2.5">
              {checklist.map((check) => (
                <li key={check.key} className="flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    id={`focus-qa-${check.key}`}
                    checked={check.checked}
                    disabled={demo || pending}
                    onChange={(event) => {
                      tick(check.key, event.target.checked);
                    }}
                    data-slot="focus-qa-check"
                    data-check={check.key}
                    className="mt-0.5 size-4 shrink-0 rounded-input border border-line2 bg-surface2 accent-[var(--accent)] disabled:cursor-not-allowed"
                  />
                  <label
                    htmlFor={`focus-qa-${check.key}`}
                    className="flex flex-col text-xs text-text2"
                  >
                    <span>{check.label}</span>
                    <span
                      className={check.checked ? 'text-[10px] text-text4' : 'text-[10px] text-warn'}
                    >
                      {check.checked ? 'Ticked' : `Required — type is ${item.briefType ?? 'Video'}`}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            <div
              data-slot="focus-qa-gate"
              className="mt-3 rounded-input border border-warn/35 bg-warn/10 px-3 py-2 text-[11px] leading-relaxed"
            >
              <p className="text-warn">{focusQaProgress(item)}</p>
              <p className="text-text3">{QA_GATE_NOTE}</p>
            </div>
          </section>
        </aside>

        {/* Right: content */}
        <div className="flex min-w-0 flex-col gap-3 p-4" data-slot="focus-content">
          <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            <section
              className="flex flex-col overflow-hidden rounded-card border border-line bg-surface"
              data-slot="focus-preview"
            >
              <div className="relative flex aspect-video items-center justify-center bg-surface2">
                {image === null ? (
                  <span className="flex flex-col items-center gap-1 text-text3">
                    <span className="font-mono text-2xl font-semibold text-text2">
                      {tile.label}
                    </span>
                    <span className="text-[10px] uppercase tracking-wide">
                      {tile.source === 'name'
                        ? 'No asset yet'
                        : tile.source === 'design-file'
                          ? 'Design file'
                          : 'Inspiration'}
                    </span>
                  </span>
                ) : (
                  <img src={image} alt={tile.alt} className="size-full object-cover" />
                )}
                {item.briefType === 'Video' || item.briefType === 'Motion Image' ? (
                  <span className="absolute left-2 bottom-2 rounded-input border border-line bg-bg-deep/70 px-1.5 py-0.5 font-mono text-[10px] text-text3">
                    {item.briefType}
                  </span>
                ) : null}
              </div>
              <div className="flex items-center justify-between gap-2 px-3 py-2">
                <span
                  className="truncate font-mono text-[10px] text-text3"
                  title={tile.url ?? undefined}
                >
                  {tile.url ?? detail.designFile?.[0] ?? 'No design file uploaded'}
                </span>
                <StatusChip tone="accent" label={`V${String(detail.version)}`} />
              </div>
            </section>
            <TextCard title="Script / Ad Content">
              {detail.scriptContent ?? detail.adContent ?? <Dash />}
              {detail.scriptContent !== null && detail.adContent !== null ? (
                <span className="mt-2 block border-t border-line pt-2">{detail.adContent}</span>
              ) : null}
            </TextCard>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <TextCard title="Brief to Design">{detail.briefToDesign ?? <Dash />}</TextCard>
            <TextCard title="Elements tested">{detail.elementsTested ?? <Dash />}</TextCard>
            <TextCard title="Offer & inspiration">
              {detail.offer ?? detail.inspiration ?? <Dash />}
              {detail.inspoLinks.length === 0 ? null : (
                <ul className="mt-2 flex flex-col gap-1 border-t border-line pt-2">
                  {detail.inspoLinks.map((url) => (
                    <li key={url} className="truncate">
                      <a
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-[11px] text-accent underline-offset-2 hover:underline"
                      >
                        {url}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </TextCard>
          </div>
          <TextCard
            title="Feedback & Comments"
            action={<StatusChip tone="mute" label={String(allComments.length)} />}
            className="flex-1"
          >
            <div className="flex flex-col gap-3" data-slot="focus-comments">
              {allComments.length === 0 ? (
                <span className="text-text4">No comments yet.</span>
              ) : null}
              {allComments.map((comment) => (
                <div key={comment.id} className="flex gap-2.5" data-slot="focus-comment">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-surface4 text-[10px] font-semibold text-text2">
                    {initials(comment.authorName)}
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-baseline gap-2">
                      <span className="text-xs font-semibold text-text2">{comment.authorName}</span>
                      <span className="text-[10px] text-text4">{comment.at}</span>
                    </span>
                    <span className="block text-xs text-text2">{comment.body}</span>
                  </span>
                </div>
              ))}
              <div className="flex items-end gap-2 border-t border-line pt-3">
                <Textarea
                  value={draft}
                  onChange={(event) => {
                    setDraft(event.target.value);
                  }}
                  placeholder={demo ? 'Sign in to comment' : 'Add a comment…'}
                  readOnly={demo}
                  rows={2}
                  aria-label="Add a comment"
                  data-slot="focus-comment-draft"
                  className="min-h-9 flex-1 text-xs"
                />
                <DisabledWrite active={demo} hint={DEMO_WRITE_HINT}>
                  <Button
                    type="button"
                    size="sm"
                    disabled={demo || pending || draft.trim() === ''}
                    onClick={post}
                    data-slot="focus-comment-post"
                    className={demo ? disabledWriteClassName : undefined}
                  >
                    Post
                  </Button>
                </DisabledWrite>
              </div>
            </div>
          </TextCard>
          <p className="text-right text-[11px] text-text4">
            <Link
              href={briefPath(item.id)}
              className="text-accent underline-offset-2 hover:underline"
              data-slot="focus-open-full"
            >
              Open full page →
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
