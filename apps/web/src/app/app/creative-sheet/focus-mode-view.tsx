'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { briefThumbnail } from '@tas/domain/creatives';
import {
  Button,
  Checkbox,
  cn,
  DEMO_WRITE_HINT,
  DisabledWrite,
  disabledWriteClassName,
  formatCommentStamp,
  formatSheetDate,
  SectionLabel,
  StatusChip,
  Textarea,
} from '@tas/ui';
import { Check, ChevronLeft, ChevronRight, Lock, LockOpen, Play, X } from '@tas/ui/icons';

import { toggleQaAction } from '@/app/app/creative-design/actions';
import { briefPath } from '@/lib/routes';

import type { SheetItemView } from './creative-sheet-workspace';
import { EM_DASH, internalStatusView, statusView, VOICEOVER_TYPE_OPTIONS } from './fields';
import {
  focusActions,
  focusCounter,
  focusIndex,
  focusQaChecklist,
  focusQaGateNote,
  focusQaGateOpen,
  focusQaMissingLabel,
  focusQaProgress,
  focusQaTrack,
  neighbourIndex,
  previewFileName,
  previewStamp,
  QA_GATE_HEADING,
  type FocusButtonState,
} from './focus-mode';
import { QaGateBox } from './qa-gate-box';
import {
  addAnnotationAction,
  addCommentAction,
  approveBriefAction,
  deleteAnnotationAction,
  deleteCommentAction,
  postCreativeCommentAction,
  requestChangesAction,
  submitToClientAction,
  type ReviewResult,
} from './review-actions';

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
  /** The Ticket 10 pins the server loaded for the focused brief's current submission. */
  readonly annotations?: readonly BriefAnnotationView[];
  /** The Ticket 10 brief-scoped thread on the current submission; empty by default. */
  readonly briefComments?: readonly BriefCommentView[];
  /** The Clerk user id of the viewer, so the thread can show author-or-admin delete controls. */
  readonly viewerClerkId?: string | null;
  /** True when the viewer may post / delete / pin — the Server Actions re-check this on write. */
  readonly viewerCanReview?: boolean;
  /** The viewer's role on the brand, so the delete gate matches the server. */
  readonly viewerIsAdmin?: boolean;
  /** The current submission version these overlays and thread live on; defaults to 1 (Ticket 10). */
  readonly submissionVersion?: number;
}

/** One annotation pin, as the server loads it for Focus Mode. */
export interface BriefAnnotationView {
  readonly id: string;
  readonly xPct: number;
  readonly yPct: number;
  readonly note: string;
  readonly authorName: string;
  readonly authorClerkId: string | null;
  readonly createdAt: string;
}

/** One comment on the brief-scoped thread. */
export interface BriefCommentView {
  readonly id: string;
  readonly body: string;
  readonly authorName: string;
  readonly authorClerkId: string | null;
  readonly createdAt: string;
  readonly parentCommentId: string | null;
}

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
        <SectionLabel rule={false}>{title}</SectionLabel>
        {action}
      </header>
      <div className="px-3 py-2.5 text-xs leading-relaxed whitespace-pre-wrap text-text2">
        {children}
      </div>
    </section>
  );
}

/** Board 1's glass play disc over the preview frame (B1.V16): white at 8% / 17% through `--on-accent`. */
function PlayDisc({ className }: { readonly className?: string }) {
  return (
    <span
      data-slot="focus-play"
      className={`flex size-[46px] items-center justify-center rounded-full border border-on-accent/17 bg-on-accent/8 backdrop-blur-[2px] ${className ?? ''}`}
    >
      <Play aria-hidden="true" className="size-[17px] fill-current text-text" />
    </span>
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

interface ThreadComment {
  readonly id: string;
  readonly authorName: string;
  readonly body: string;
  readonly at: string;
  /** The relative wording, for the stamp's title; a comment posted this session has none yet. */
  readonly ago?: string;
}

/** One card in the Ticket 10 Review Thread panel: author, timestamp, body, controls. */
function ThreadCard({
  comment,
  canDelete,
  onDelete,
  onReply,
}: {
  readonly comment: BriefCommentView;
  readonly canDelete: boolean;
  readonly onDelete: () => void;
  readonly onReply: (() => void) | null;
}) {
  return (
    <div className="flex items-start gap-2.5 rounded-input border border-line bg-surface2 px-3 py-2">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-line text-[10px] font-semibold text-on-accent">
        {initials(comment.authorName)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-semibold text-text2">{comment.authorName}</span>
          <span className="text-[10px] text-text4">{formatCommentStamp(comment.createdAt)}</span>
        </div>
        <p className="whitespace-pre-wrap text-xs leading-relaxed text-text2">{comment.body}</p>
        {onReply === null && !canDelete ? null : (
          <div className="mt-1.5 flex items-center gap-2 text-[11px] text-text3">
            {onReply === null ? null : (
              <button
                type="button"
                onClick={onReply}
                data-slot="brief-reply"
                className="text-accent underline-offset-2 hover:underline"
              >
                Reply
              </button>
            )}
            {canDelete ? (
              <button
                type="button"
                onClick={onDelete}
                data-slot="brief-comment-delete"
                className="text-bad underline-offset-2 hover:underline"
              >
                Delete
              </button>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

export function FocusModeView({
  items,
  focusedId,
  onFocus,
  demo,
  annotations = [],
  briefComments = [],
  viewerClerkId = null,
  viewerCanReview = true,
  viewerIsAdmin = false,
  submissionVersion = 1,
}: FocusModeViewProps) {
  const router = useRouter();
  const ids = useMemo(() => items.map((view) => view.item.id), [items]);
  const index = focusIndex(ids, focusedId);
  const view = index === -1 ? null : (items[index] ?? null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [posted, setPosted] = useState<readonly ThreadComment[]>([]);
  const [draft, setDraft] = useState('');
  // The Ticket 10 overlay and thread local-state: new pins and comments posted this session.
  const [localPins, setLocalPins] = useState<readonly BriefAnnotationView[]>([]);
  const [removedPinIds, setRemovedPinIds] = useState<ReadonlySet<string>>(() => new Set());
  const [localThread, setLocalThread] = useState<readonly BriefCommentView[]>([]);
  const [removedThreadIds, setRemovedThreadIds] = useState<ReadonlySet<string>>(() => new Set());
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState('');
  const [rootDraft, setRootDraft] = useState('');
  const [pinDraft, setPinDraft] = useState<{ x: number; y: number; note: string } | null>(null);

  // The comments the page loaded plus the ones posted since, until the refresh brings them back.
  useEffect(() => {
    setPosted([]);
    setDraft('');
    setError(null);
    setLocalPins([]);
    setLocalThread([]);
    setRemovedPinIds(new Set());
    setRemovedThreadIds(new Set());
    setReplyingTo(null);
    setReplyDraft('');
    setRootDraft('');
    setPinDraft(null);
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

  /* ----- Ticket 10 overlay + thread handlers ----- */
  const openPinDraft = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (view === null || demo || !viewerCanReview) {
      // The server would refuse; keep the overlay inert so the viewer sees why from the button hint.
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    setPinDraft({ x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)), note: '' });
  };

  const savePinDraft = () => {
    if (view === null || pinDraft === null || pinDraft.note.trim() === '') return;
    setError(null);
    startTransition(async () => {
      const result = await addAnnotationAction(
        view.item.id,
        submissionVersion,
        pinDraft.x,
        pinDraft.y,
        pinDraft.note,
      );
      if (result.ok) {
        setLocalPins((current) => [
          ...current,
          {
            id: result.annotation.id,
            xPct: Number(result.annotation.xPct),
            yPct: Number(result.annotation.yPct),
            note: result.annotation.note,
            authorName: 'You',
            authorClerkId: viewerClerkId,
            createdAt: result.annotation.createdAt.toISOString(),
          },
        ]);
        setPinDraft(null);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  };

  const removePin = (id: string, authorClerkId: string | null) => {
    if (demo) return;
    const own = authorClerkId !== null && authorClerkId === viewerClerkId;
    if (!own && !viewerIsAdmin) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteAnnotationAction(id);
      if (result.ok) {
        setRemovedPinIds((current) => new Set([...current, id]));
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  };

  const addThreadComment = (parentId: string | null, body: string) => {
    if (view === null || demo || body.trim() === '') return;
    setError(null);
    startTransition(async () => {
      const result = await addCommentAction(view.item.id, submissionVersion, body, parentId);
      if (result.ok) {
        setLocalThread((current) => [
          ...current,
          {
            id: result.comment.id,
            body: result.comment.body,
            authorName: 'You',
            authorClerkId: viewerClerkId,
            createdAt: result.comment.createdAt.toISOString(),
            parentCommentId: result.comment.parentCommentId,
          },
        ]);
        if (parentId === null) setRootDraft('');
        else {
          setReplyDraft('');
          setReplyingTo(null);
        }
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  };

  const removeThreadComment = (id: string, authorClerkId: string | null) => {
    if (demo) return;
    const own = authorClerkId !== null && authorClerkId === viewerClerkId;
    if (!own && !viewerIsAdmin) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteCommentAction(id);
      if (result.ok) {
        setRemovedThreadIds((current) => new Set([...current, id]));
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
  const qaTrack = focusQaTrack(item);
  const missingLabel = focusQaMissingLabel(item);
  const image = firstImage(detail.designFile) ?? firstImage(detail.inspirationImage);
  const tile = briefThumbnail({
    name: item.briefName ?? item.name,
    designFileUrl: item.briefDesignFileUrl,
    inspoLinks: detail.inspoLinks,
  });
  const fileUrl = tile.url ?? detail.designFile?.[0] ?? null;
  // A stamp exists exactly for the types that play, which is when the frame gets the play disc.
  const stamp = previewStamp(item);
  const plays = stamp !== null;
  const allComments: readonly ThreadComment[] = [...comments, ...posted];
  // Pins the server loaded, plus pins placed this session, minus the ones removed this session.
  const visiblePins = [...annotations, ...localPins].filter((pin) => !removedPinIds.has(pin.id));
  const liveThread = [...briefComments, ...localThread].filter((c) => !removedThreadIds.has(c.id));
  const roots = liveThread.filter((c) => c.parentCommentId === null);
  const repliesByParent = new Map<string, BriefCommentView[]>();
  for (const c of liveThread) {
    if (c.parentCommentId !== null) {
      const list = repliesByParent.get(c.parentCommentId) ?? [];
      list.push(c);
      repliesByParent.set(c.parentCommentId, list);
    }
  }

  const button = (
    label: string,
    icon: ReactNode,
    state: FocusButtonState,
    onClick: () => void,
    slot: string,
    variant: 'outline' | 'default' | 'success',
    extraClass = '',
  ) => {
    const disabled = demo || pending || !state.enabled;
    // A guard refusal is the more specific reason, so it beats the demo hint (B4.V13); the demo
    // hint stays for a button the guard would allow. The QA refusal alone gets the warn heading
    // and the missing tick's name in bold (B1.A6); every other hint renders as the guard wrote it.
    const hint = !state.enabled && state.hint !== null ? state.hint : demo ? DEMO_WRITE_HINT : '';
    const qaGated = state.kind === 'qa';
    return (
      <DisabledWrite
        active={disabled && hint !== ''}
        hint={hint}
        popover
        heading={qaGated ? QA_GATE_HEADING : undefined}
        hintEmphasis={qaGated ? (missingLabel ?? undefined) : undefined}
      >
        <Button
          type="button"
          size="sm"
          variant={variant}
          disabled={disabled}
          onClick={onClick}
          data-slot={slot}
          title={hint === '' ? undefined : hint}
          className={`text-xs ${disabled ? disabledWriteClassName : ''} ${extraClass}`}
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
      className="flex flex-col overflow-hidden border-t border-line bg-bg lg:min-h-[calc(100vh-14rem)]"
    >
      {/* Focus bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line bg-surface px-5 py-3">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <div className="flex items-center gap-0.5 rounded-card border border-line bg-surface2 p-0.5">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="size-7 hover:bg-surface4"
              aria-label="Previous creative"
              data-slot="focus-prev"
              disabled={index <= 0}
              onClick={() => {
                go(-1);
              }}
            >
              <ChevronLeft aria-hidden="true" className="size-[15px]" />
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
              className="size-7 hover:bg-surface4"
              aria-label="Next creative"
              data-slot="focus-next"
              disabled={index >= ids.length - 1}
              onClick={() => {
                go(1);
              }}
            >
              <ChevronRight aria-hidden="true" className="size-[15px]" />
            </Button>
          </div>
          <span className="hidden h-5 w-px bg-line sm:block" />
          <span
            data-slot="focus-name"
            className="truncate font-mono text-[13px] font-medium tracking-[-.01em] text-text"
          >
            {item.briefName ?? item.name}
          </span>
          {internal === null ? null : <StatusChip tone={internal.tone} label={internal.label} />}
          {client === null ? null : <StatusChip tone={client.tone} label={client.label} />}
        </div>
        <div className="flex flex-wrap items-center gap-2" data-slot="focus-actions">
          {button(
            'Request Changes',
            <X aria-hidden="true" className="size-3.5" strokeWidth={2} />,
            actions.requestChanges,
            () => {
              run(requestChangesAction);
            },
            'focus-request-changes',
            'outline',
            'border-bad/45 bg-bad/10 text-bad hover:bg-bad/15 hover:text-bad',
          )}
          {button(
            'Approve',
            <Check aria-hidden="true" className="size-3.5" strokeWidth={2.4} />,
            actions.approve,
            () => {
              run(approveBriefAction);
            },
            'focus-approve',
            'success',
          )}
          {button(
            'Submit to Client',
            actions.submitToClient.enabled ? (
              <LockOpen aria-hidden="true" className="size-3.5" strokeWidth={1.8} />
            ) : (
              <Lock aria-hidden="true" className="size-3.5" strokeWidth={1.8} />
            ),
            actions.submitToClient,
            () => {
              run(submitToClientAction);
            },
            'focus-submit',
            'default',
            'font-semibold',
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

      <div className="grid flex-1 gap-0 lg:grid-cols-[300px_minmax(0,1fr)]">
        {/* Left: metadata */}
        <aside
          className="flex flex-col border-b border-line bg-surface lg:border-r lg:border-b-0"
          data-slot="focus-meta"
        >
          <section className="border-b border-line px-4 py-3">
            <SectionLabel rule={false} className="mb-2.5">
              Identity
            </SectionLabel>
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
            <SectionLabel rule={false} className="mb-2.5">
              Status
            </SectionLabel>
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
              {detail.dueDate === null ? <Dash /> : formatSheetDate(detail.dueDate)}
            </Row>
            <Row label="Assignee">{detail.assignee ?? <Dash />}</Row>
          </section>
          <section className="px-4 py-3" data-slot="focus-qa">
            <SectionLabel rule={false} className="mb-2.5">
              QA Checklist
            </SectionLabel>
            <ul className="flex flex-col gap-2.5">
              {checklist.map((check) => (
                <li key={check.key} className="flex items-start gap-2.5">
                  <Checkbox
                    id={`focus-qa-${check.key}`}
                    checked={check.checked}
                    disabled={demo || pending}
                    onChange={(event) => {
                      tick(check.key, event.target.checked);
                    }}
                    data-slot="focus-qa-check"
                    data-check={check.key}
                    className="mt-0.5"
                  />
                  <label
                    htmlFor={`focus-qa-${check.key}`}
                    className="flex flex-col text-xs text-text2"
                  >
                    <span>{check.label}</span>
                    <span
                      className={check.checked ? 'text-[10px] text-text4' : 'text-[10px] text-warn'}
                    >
                      {check.checked ? 'Ticked' : `Required on the ${qaTrack} track`}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            <QaGateBox
              progress={focusQaProgress(item)}
              open={focusQaGateOpen(item)}
              note={focusQaGateNote(item)}
            />
          </section>
        </aside>

        {/* Right: content */}
        <div className="flex min-w-0 flex-col gap-3.5 p-4" data-slot="focus-content">
          <div className="grid gap-3.5 lg:grid-cols-[392px_minmax(0,1fr)]">
            <section
              className="flex flex-col overflow-hidden rounded-card border border-line bg-surface"
              data-slot="focus-preview"
            >
              <div
                className="relative flex aspect-video items-center justify-center bg-linear-to-br from-surface3 via-surface2 via-55% to-bg-deep"
                data-slot="focus-overlay"
                data-interactive={!demo && viewerCanReview ? 'true' : 'false'}
                onClick={openPinDraft}
                role={!demo && viewerCanReview ? 'button' : undefined}
                aria-label={!demo && viewerCanReview ? 'Click to place a pin' : undefined}
              >
                {image === null ? (
                  <span className="flex flex-col items-center gap-1 text-text3">
                    {plays ? (
                      <PlayDisc />
                    ) : (
                      <span className="font-mono text-2xl font-semibold text-text2">
                        {tile.label}
                      </span>
                    )}
                    <span className="text-[10px] uppercase tracking-wide">
                      {tile.source === 'name'
                        ? 'No asset yet'
                        : tile.source === 'design-file'
                          ? 'Design file'
                          : 'Inspiration'}
                    </span>
                  </span>
                ) : (
                  <>
                    <img src={image} alt={tile.alt} className="size-full object-cover" />
                    {plays ? <PlayDisc className="absolute inset-0 m-auto" /> : null}
                  </>
                )}
                {plays ? (
                  <span className="absolute left-2 bottom-2 rounded-input border border-line bg-bg-deep/70 px-1.5 py-0.5 font-mono text-[10px] text-text3">
                    {stamp}
                  </span>
                ) : null}
                {visiblePins.map((pin, idx) => (
                  <button
                    key={pin.id}
                    type="button"
                    data-slot="focus-pin"
                    data-pin-id={pin.id}
                    title={`${pin.authorName}: ${pin.note}`}
                    aria-label={`Pin ${String(idx + 1)} by ${pin.authorName}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      removePin(pin.id, pin.authorClerkId);
                    }}
                    className="absolute flex size-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-on-accent/40 bg-accent text-[10px] font-semibold text-on-accent shadow-sm"
                    style={{ left: `${String(pin.xPct)}%`, top: `${String(pin.yPct)}%` }}
                  >
                    {initials(pin.authorName).charAt(0) || String(idx + 1)}
                  </button>
                ))}
                {pinDraft === null ? null : (
                  <div
                    data-slot="focus-pin-draft"
                    onClick={(event) => {
                      event.stopPropagation();
                    }}
                    className="absolute z-10 flex min-w-[220px] -translate-x-1/2 translate-y-2 flex-col gap-2 rounded-card border border-line bg-surface p-2 shadow-md"
                    style={{ left: `${String(pinDraft.x)}%`, top: `${String(pinDraft.y)}%` }}
                  >
                    <Textarea
                      value={pinDraft.note}
                      onChange={(event) => {
                        setPinDraft({ ...pinDraft, note: event.target.value });
                      }}
                      rows={2}
                      aria-label="Pin note"
                      placeholder="Note on this frame…"
                      className="min-h-14 text-xs"
                    />
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="text-xs"
                        onClick={() => {
                          setPinDraft(null);
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className="text-xs font-semibold"
                        disabled={pinDraft.note.trim() === '' || pending}
                        onClick={savePinDraft}
                        data-slot="focus-pin-save"
                      >
                        Save
                      </Button>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between gap-2 px-3 py-2">
                <span
                  className="truncate font-mono text-[10px] text-text3"
                  title={fileUrl ?? undefined}
                >
                  {fileUrl === null ? 'No design file uploaded' : previewFileName(fileUrl)}
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
          <div className="grid gap-3.5 md:grid-cols-3">
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
          {/* Ticket 6 Content fields (migration 0069): the four new strategist-authored columns on
              the brief, under the existing scripts/elements row — Brief, Music, Voiceover type,
              Voiceover script. Each card renders Dash when the column is NULL. */}
          <div className="grid gap-3.5 md:grid-cols-2" data-slot="focus-content-fields">
            <TextCard title="Brief">{detail.briefText ?? <Dash />}</TextCard>
            <TextCard title="Music">{detail.music ?? <Dash />}</TextCard>
            <TextCard title="Voiceover type">
              {detail.voiceoverType === null ? (
                <Dash />
              ) : (
                (VOICEOVER_TYPE_OPTIONS.find((option) => option.key === detail.voiceoverType)
                  ?.label ?? detail.voiceoverType)
              )}
            </TextCard>
            <TextCard title="Voiceover script">{detail.voiceoverScript ?? <Dash />}</TextCard>
          </div>
          <TextCard
            title="Review Thread"
            action={<StatusChip tone="mute" label={String(liveThread.length)} />}
          >
            <div className="flex flex-col gap-3" data-slot="brief-comment-thread">
              <div className="flex max-h-72 flex-col gap-3 overflow-y-auto">
                {roots.length === 0 ? (
                  <span className="text-text4">No review notes on this version yet.</span>
                ) : null}
                {roots.map((root) => {
                  const canDelete =
                    viewerIsAdmin ||
                    (root.authorClerkId !== null && root.authorClerkId === viewerClerkId);
                  const replies = repliesByParent.get(root.id) ?? [];
                  return (
                    <div key={root.id} className="flex flex-col gap-1.5" data-slot="brief-comment">
                      <ThreadCard
                        comment={root}
                        canDelete={canDelete && !demo}
                        onDelete={() => {
                          removeThreadComment(root.id, root.authorClerkId);
                        }}
                        onReply={
                          viewerCanReview && !demo
                            ? () => {
                                setReplyingTo(root.id);
                                setReplyDraft('');
                              }
                            : null
                        }
                      />
                      {replies.length === 0 ? null : (
                        <div className="flex flex-col gap-1.5 pl-8">
                          {replies.map((reply) => {
                            const replyCanDelete =
                              viewerIsAdmin ||
                              (reply.authorClerkId !== null &&
                                reply.authorClerkId === viewerClerkId);
                            return (
                              <ThreadCard
                                key={reply.id}
                                comment={reply}
                                canDelete={replyCanDelete && !demo}
                                onDelete={() => {
                                  removeThreadComment(reply.id, reply.authorClerkId);
                                }}
                                onReply={null}
                              />
                            );
                          })}
                        </div>
                      )}
                      {replyingTo === root.id ? (
                        <div className="flex items-center gap-2 pl-8">
                          <Textarea
                            value={replyDraft}
                            onChange={(event) => {
                              setReplyDraft(event.target.value);
                            }}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' && !event.shiftKey) {
                                event.preventDefault();
                                addThreadComment(root.id, replyDraft);
                              }
                            }}
                            rows={1}
                            placeholder="Reply…"
                            aria-label="Reply"
                            className="min-h-8 flex-1 text-xs"
                            data-slot="brief-reply-draft"
                          />
                          <Button
                            type="button"
                            size="sm"
                            className="text-xs font-semibold"
                            disabled={replyDraft.trim() === '' || pending}
                            onClick={() => {
                              addThreadComment(root.id, replyDraft);
                            }}
                          >
                            Send
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
              {viewerCanReview ? (
                <div className="flex items-center gap-2 border-t border-line pt-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-surface4 text-[10px] font-semibold text-text3">
                    You
                  </span>
                  <Textarea
                    value={rootDraft}
                    onChange={(event) => {
                      setRootDraft(event.target.value);
                    }}
                    rows={1}
                    placeholder={demo ? 'Sign in to comment' : 'Leave a review note…'}
                    readOnly={demo}
                    aria-label="Add a review note"
                    data-slot="brief-root-draft"
                    className="min-h-8 flex-1 text-xs"
                  />
                  <DisabledWrite active={demo} hint={DEMO_WRITE_HINT}>
                    <Button
                      type="button"
                      size="sm"
                      disabled={demo || pending || rootDraft.trim() === ''}
                      onClick={() => {
                        addThreadComment(null, rootDraft);
                      }}
                      data-slot="brief-root-post"
                      className={cn('font-semibold', demo && disabledWriteClassName)}
                    >
                      Post
                    </Button>
                  </DisabledWrite>
                </div>
              ) : null}
            </div>
          </TextCard>
          <TextCard
            title="Feedback & Comments"
            action={<StatusChip tone="mute" label={String(allComments.length)} />}
            className="flex-1"
          >
            <div className="flex flex-col gap-3" data-slot="focus-comments">
              <div className="flex max-h-64 flex-col gap-3 overflow-y-auto">
                {allComments.length === 0 ? (
                  <span className="text-text4">No comments yet.</span>
                ) : null}
                {allComments.map((comment) => (
                  <div key={comment.id} className="flex gap-2.5" data-slot="focus-comment">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-line text-[10px] font-semibold text-on-accent">
                      {initials(comment.authorName)}
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-baseline gap-2">
                        <span className="text-xs font-semibold text-text2">
                          {comment.authorName}
                        </span>
                        <span className="text-[10px] text-text4" title={comment.ago}>
                          {comment.at}
                        </span>
                      </span>
                      <span className="block text-xs text-text2">{comment.body}</span>
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 border-t border-line pt-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-surface4 text-[10px] font-semibold text-text3">
                  You
                </span>
                <Textarea
                  value={draft}
                  onChange={(event) => {
                    setDraft(event.target.value);
                  }}
                  placeholder={demo ? 'Sign in to comment' : 'Add a comment…'}
                  readOnly={demo}
                  rows={1}
                  aria-label="Add a comment"
                  data-slot="focus-comment-draft"
                  className="min-h-8 flex-1 text-xs"
                />
                <DisabledWrite active={demo} hint={DEMO_WRITE_HINT}>
                  <Button
                    type="button"
                    size="sm"
                    disabled={demo || pending || draft.trim() === ''}
                    onClick={post}
                    data-slot="focus-comment-post"
                    className={cn('font-semibold', demo && disabledWriteClassName)}
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
