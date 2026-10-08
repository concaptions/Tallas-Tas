'use client';

import { startTransition, useActionState, useEffect, useId, useState } from 'react';
import {
  Button,
  DEMO_WRITE_HINT,
  disabledWriteClassName,
  DisabledWrite,
  Label,
  RatingStars,
  Textarea,
} from '@tas/ui';
import { RATING_NOTE_MAX } from '@tas/domain/creators';

import type { CreatorActionResult } from './actions';
import {
  NOT_RATED_NOTE,
  RATING_ADMIN_ONLY_NOTE,
  RATING_REQUIRED_HINT,
  ratedLine,
  ratingNoteCounter,
  ratingNoteTooLong,
} from './fields';
import { rateCreatorAction } from './rating-actions';

export interface RatingWidgetProps {
  readonly creatorId: string;
  readonly rating: number | null;
  readonly note: string | null;
  readonly ratedAt: Date | null;
  /** The rater's Clerk user id; rendered in `font-mono` like every other system id. */
  readonly ratedBy: string | null;
  /** Agency admin only: anyone else sees the rating read-only. */
  readonly canRate: boolean;
  /** The request's one clock, so "3 days ago" is the same string on the server and the client. */
  readonly now: Date;
  readonly demo?: boolean;
  readonly onSaved?: (id: string) => void;
}

/**
 * The per-brand performance rating on the creator panel (Oct 8 Talal ask): the stars, an optional
 * note with its counter, Save, and the "rated by · when" receipt.
 *
 * NO `<form>` OF ITS OWN. The panel already wraps every section in the creator form, and a form
 * cannot nest in a form, so the Save builds the `FormData` itself and hands it to the action
 * returned by `useActionState` inside a transition — the same action, the same result shape and
 * the same pending state a form submit would give, without a second form element. The note
 * textarea therefore carries no `name`, so the creator Save never posts it.
 */
export function RatingWidget({
  creatorId,
  rating,
  note,
  ratedAt,
  ratedBy,
  canRate,
  now,
  demo = false,
  onSaved,
}: RatingWidgetProps) {
  const [state, formAction, pending] = useActionState<CreatorActionResult | null, FormData>(
    rateCreatorAction,
    null,
  );
  const [draftRating, setDraftRating] = useState<number | null>(rating);
  const [draftNote, setDraftNote] = useState(note ?? '');
  const noteId = useId();

  useEffect(() => {
    if (state !== null && state.ok) onSaved?.(state.id);
  }, [state, onSaved]);

  const receipt = ratedLine(ratedBy, ratedAt, now);
  const receiptLine =
    receipt === null ? (
      <p className="text-xs text-text3" data-slot="rating-unrated">
        {NOT_RATED_NOTE}
      </p>
    ) : (
      <p className="text-xs text-text3" data-slot="rating-receipt">
        Rated by <span className="font-mono text-text2">{receipt.by}</span>{' '}
        <time dateTime={ratedAt?.toISOString()} title={receipt.title}>
          {receipt.when}
        </time>
      </p>
    );

  if (!canRate) {
    return (
      <div className="flex flex-col gap-2" data-slot="rating-widget" data-editable="false">
        <RatingStars value={rating} readOnly label="Performance rating" />
        {note !== null && note.trim() !== '' ? (
          <p className="text-sm leading-relaxed text-text2">{note}</p>
        ) : null}
        {receiptLine}
        <p className="text-xs text-text4">{RATING_ADMIN_ONLY_NOTE}</p>
      </div>
    );
  }

  const tooLong = ratingNoteTooLong(draftNote);
  const blocked = demo || draftRating === null || tooLong;
  const blockedHint = demo
    ? DEMO_WRITE_HINT
    : draftRating === null
      ? RATING_REQUIRED_HINT
      : `Keep the note under ${String(RATING_NOTE_MAX)} characters.`;

  const save = () => {
    if (draftRating === null || blocked) return;
    const formData = new FormData();
    formData.set('id', creatorId);
    formData.set('rating', String(draftRating));
    formData.set('note', draftNote);
    startTransition(() => {
      formAction(formData);
    });
  };

  return (
    <div className="flex flex-col gap-3" data-slot="rating-widget" data-editable="true">
      <RatingStars
        value={draftRating}
        onChange={setDraftRating}
        disabled={demo || pending}
        label="Performance rating"
      />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={noteId} className="text-[11px] tracking-wide text-text3 uppercase">
          Note
        </Label>
        <Textarea
          id={noteId}
          value={draftNote}
          readOnly={demo}
          disabled={pending}
          rows={3}
          placeholder="What stood out, good or bad."
          aria-invalid={tooLong || undefined}
          onChange={(event) => {
            setDraftNote(event.target.value);
          }}
        />
        <span
          className={`self-end font-mono text-[11px] ${tooLong ? 'text-bad' : 'text-text4'}`}
          data-slot="rating-note-counter"
        >
          {ratingNoteCounter(draftNote)}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {receiptLine}
        <div className="ml-auto flex items-center gap-2">
          {state !== null && !state.ok ? (
            <span className="text-xs text-bad" data-slot="rating-error">
              {state.error}
            </span>
          ) : null}
          {state !== null && state.ok ? (
            <span className="text-xs text-ok" data-slot="rating-saved" key={state.savedAt}>
              Saved
            </span>
          ) : null}
          <DisabledWrite active={blocked} hint={blockedHint}>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={blocked || pending}
              onClick={save}
              data-slot="rating-save"
              className={disabledWriteClassName}
            >
              {pending ? 'Saving…' : 'Save rating'}
            </Button>
          </DisabledWrite>
        </div>
      </div>
    </div>
  );
}
