'use client';

import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { validateThemeDraft } from '@tas/domain/themes';
import {
  Button,
  DEMO_WRITE_HINT,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  disabledWriteClassName,
  DisabledWrite,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SoonChip,
  Textarea,
} from '@tas/ui';

import { createThemeAction, type ThemeActionResult } from './actions';
import {
  DEMO_DIALOG_NOTICE,
  GLOBAL_BADGE_NOTE,
  NOT_SET,
  REFERENCE_LINKS_SOON_HINT,
  THEME_CATEGORIES,
} from './fields';

interface NewThemeDialogProps {
  readonly demo: boolean;
  /** Called after a save lands, so the grid can pick the new row up. */
  readonly onSaved: () => void;
}

/**
 * The New theme form, in a `Dialog` from `@tas/ui` (ticket criterion 8).
 *
 * A modal rather than the right-hand panel Personas and Angles use, and deliberately: this form
 * creates a row in the library every brand reads, so it is the one moment on the page that should
 * take the whole screen and say so. The dialog repeats the GLOBAL sentence for exactly that reason.
 *
 * The name is TYPED. Non-negotiable 4 governs *generated* names — a concept is Batch-Angle-Theme —
 * and the Theme half has to have been named by a human for that formula to have anything to read,
 * so this is a real text field, not a preview of a formula.
 *
 * `validateThemeDraft` from `@tas/domain/themes` decides whether the save is enabled; the Server
 * Action re-runs the same function before it writes, because a disabled button is a courtesy and
 * not a guarantee. No rule is restated here, and no message is written here.
 *
 * DEMO MODE: the trigger and the save are both inert, wrapped in `DisabledWrite` with
 * `disabledWriteClassName` so a disabled control still explains itself on hover — a disabled button
 * receives no pointer events and could never carry its own tooltip. The footer says so in words as
 * well. If a submit ever reached the action anyway, it answers with the same sentence the tooltip
 * shows, so the failure line below renders `result.error` verbatim with no special case.
 *
 * Reference links are visible but inert, exactly as the Angles panel renders Type: link editing
 * ships with Attachments, and a field that silently discarded what was typed into it would be
 * worse than one that says it is not ready.
 */
export function NewThemeDialog({ demo, onSaved }: NewThemeDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ThemeActionResult | null, FormData>(
    createThemeAction,
    null,
  );

  const [name, setName] = useState('');
  const [category, setCategory] = useState('');

  useEffect(() => {
    if (state !== null && state.ok) {
      setOpen(false);
      setName('');
      setCategory('');
      router.refresh();
      onSaved();
    }
  }, [state, router, onSaved]);

  const draft = validateThemeDraft({ name, category: category === '' ? null : category });

  const blocked = demo || !draft.ok;
  const blockedHint = demo
    ? DEMO_WRITE_HINT
    : (Object.values(draft.fieldErrors)[0] ?? 'Nothing to save yet.');

  const nameError = state !== null && !state.ok ? state.fieldErrors?.name : undefined;
  const categoryError = state !== null && !state.ok ? state.fieldErrors?.category : undefined;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DisabledWrite active={demo} hint={DEMO_WRITE_HINT}>
        <DialogTrigger asChild>
          <Button
            size="sm"
            disabled={demo}
            className={demo ? disabledWriteClassName : undefined}
            data-slot="new-theme"
          >
            New theme
          </Button>
        </DialogTrigger>
      </DisabledWrite>

      <DialogContent data-slot="new-theme-dialog" className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>New theme</DialogTitle>
          <DialogDescription>{GLOBAL_BADGE_NOTE}</DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label
              htmlFor="theme-field-name"
              className="text-[11px] tracking-wide text-text3 uppercase"
            >
              Theme Name
            </Label>
            <Input
              id="theme-field-name"
              name="name"
              value={name}
              readOnly={demo}
              aria-invalid={nameError !== undefined}
              placeholder="Problem/Solution"
              data-slot="theme-name-input"
              onChange={(event) => {
                setName(event.target.value);
              }}
            />
            {nameError === undefined ? null : <p className="text-xs text-bad">{nameError}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label
              htmlFor="theme-field-category"
              className="text-[11px] tracking-wide text-text3 uppercase"
            >
              Category
            </Label>
            <Select
              value={category === '' ? undefined : category}
              onValueChange={setCategory}
              disabled={demo}
            >
              <SelectTrigger
                id="theme-field-category"
                className="w-full"
                aria-label="Category"
                data-slot="theme-category"
              >
                <SelectValue placeholder="Pick the kind of theme this is" />
              </SelectTrigger>
              <SelectContent>
                {THEME_CATEGORIES.map((entry) => (
                  // The stored value verbatim, never a slug: the action rejects anything else.
                  <SelectItem key={entry.key} value={entry.key}>
                    {entry.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input type="hidden" name="category" value={category} />
            {categoryError === undefined ? null : (
              <p className="text-xs text-bad">{categoryError}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label
              htmlFor="theme-field-notes"
              className="text-[11px] tracking-wide text-text3 uppercase"
            >
              Notes
            </Label>
            <Textarea
              id="theme-field-notes"
              name="notes"
              readOnly={demo}
              placeholder={NOT_SET}
              data-slot="theme-notes"
              className="min-h-24 leading-relaxed"
            />
            <p className="text-xs text-text3">
              When to reach for this theme, and what went wrong last time it was shot.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="flex items-center gap-2 text-[11px] tracking-wide text-text3 uppercase">
              Reference Links
              <SoonChip />
            </Label>
            <DisabledWrite hint={REFERENCE_LINKS_SOON_HINT} className="w-full">
              <Input
                disabled
                aria-label="Reference links"
                placeholder="https://foreplay.example/boards/problem-solution"
                data-slot="theme-reference-links"
                className="w-full font-mono text-xs"
              />
            </DisabledWrite>
          </div>

          <DialogFooter className="flex-wrap gap-3">
            {demo ? (
              <p className="mr-auto text-xs text-text3" data-slot="theme-demo-note">
                {DEMO_DIALOG_NOTICE}
              </p>
            ) : state !== null && !state.ok ? (
              <p className="mr-auto text-xs text-bad" data-slot="theme-error">
                {state.error}
              </p>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setOpen(false);
              }}
            >
              Cancel
            </Button>
            <DisabledWrite active={blocked} hint={blockedHint}>
              <Button
                type="submit"
                size="sm"
                disabled={blocked || pending}
                data-slot="theme-save"
                className={disabledWriteClassName}
              >
                {pending ? 'Saving…' : 'Save theme'}
              </Button>
            </DisabledWrite>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
