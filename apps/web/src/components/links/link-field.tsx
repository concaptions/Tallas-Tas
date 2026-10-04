'use client';

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LINK_REGISTRY, normaliseLinkIds, type LinkKind } from '@tas/domain';
import type { ChipTone } from '@tas/domain/state';
import {
  Button,
  DEMO_WRITE_HINT,
  DisabledWrite,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  Label,
  StatusChip,
} from '@tas/ui';

import { setLinksAction } from '@/lib/link-actions';

export interface LinkOption {
  readonly id: string;
  readonly name: string;
  /**
   * Where the linked record lives. A side that used to show a read-only list of records carried the
   * record's own route; making that side editable must not cost the reader the way there, so a chip
   * with an `href` is a link to the record and one without stays plain text.
   */
  readonly href?: string;
  /** The record's own status, drawn beside its name — the same chip its module renders. */
  readonly chip?: { readonly label: string; readonly tone: ChipTone };
}

export interface LinkFieldProps {
  /** Which junction, read from which side: `concept-angles`, `angle-concepts`, … */
  readonly link: LinkKind;
  /** The record the field sits on; null while it is being created (the form then carries the ids). */
  readonly sourceId: string | null;
  readonly options: readonly LinkOption[];
  readonly selectedIds: readonly string[];
  /** Reports every change, so a form can mirror the selection (and a name can derive from it). */
  readonly onChange?: (ids: readonly string[]) => void;
  /** The name the hidden inputs post under, one per selected id; absent posts nothing. */
  readonly inputName?: string;
  readonly label?: string;
  readonly demo: boolean;
  readonly error?: string;
  readonly slot?: string;
  /** What the field says when nothing is linked. */
  readonly empty?: string;
  /**
   * Marks the label Required or Optional, when the form this sits in has decided. Left out, the
   * label says nothing, which is what every existing caller wants: a link is optional on most
   * panels and mandatory only where a save path says so (a concept's Angle).
   */
  readonly required?: boolean;
}

/**
 * The one link control (Sprint 9, LINK-01), mounted on BOTH sides of every link: a concept's
 * creators and a creator's concepts, an angle's products and a product's angles, and so on. It
 * shows the linked records as chips, offers the rest in a searchable checklist, and on every change
 * writes the junction through `setLinksAction` — the same rows the other side reads, so a link made
 * here is on the other record's panel on its next render. It never stores a copy anywhere.
 *
 * On a record that does not exist yet (`sourceId` null) it writes nothing and only posts the
 * hidden inputs, so the create action can sync the junction once the row has an id. In demo mode
 * the control is read-only with the usual reason.
 *
 * An option may carry an `href` and a `chip` of its own, which is what lets a side that showed a
 * read-only list of records become editable without losing anything: the chip keeps the record's
 * route and its status beside its name.
 */
export function LinkField({
  link,
  sourceId,
  options,
  selectedIds,
  onChange,
  inputName,
  label,
  demo,
  error,
  slot,
  empty = 'Nothing linked yet.',
  required,
}: LinkFieldProps) {
  const router = useRouter();
  const entry = LINK_REGISTRY[link];
  const [ids, setIds] = useState<readonly string[]>(() => normaliseLinkIds(selectedIds));
  const [query, setQuery] = useState('');
  const [failure, setFailure] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // A fresh record (a new `sourceId`, a refresh that changed the row) resets the field. The ids
  // are compared as one string so a re-render with an equal list does not reset a pending edit.
  const selectedKey = selectedIds.join('|');
  useEffect(() => {
    setIds(normaliseLinkIds(selectedKey === '' ? [] : selectedKey.split('|')));
  }, [sourceId, selectedKey]);

  const byId = useMemo(() => new Map(options.map((option) => [option.id, option])), [options]);
  const chosen = ids.map((id) => byId.get(id) ?? { id, name: id });
  const term = query.trim().toLowerCase();
  const offered = options.filter(
    (option) => term === '' || option.name.toLowerCase().includes(term),
  );

  const commit = useCallback(
    (next: readonly string[]) => {
      const normalised = normaliseLinkIds(next);
      setIds(normalised);
      onChange?.(normalised);
      if (demo || sourceId === null) return;
      setFailure(null);
      startTransition(async () => {
        const result = await setLinksAction({ link, sourceId, targetIds: normalised });
        if (!result.ok) {
          setFailure(result.error);
          return;
        }
        router.refresh();
      });
    },
    [demo, link, onChange, router, sourceId],
  );

  const toggle = (id: string) => {
    commit(ids.includes(id) ? ids.filter((entryId) => entryId !== id) : [...ids, id]);
  };

  const heading = label ?? entry.label;
  const baseSlot = slot ?? `link-${link}`;

  return (
    <div className="flex min-w-0 flex-col gap-1.5" data-slot={baseSlot} data-link={link}>
      <Label required={required} className="text-[11px] tracking-wide text-text3 uppercase">
        {heading}
      </Label>
      <div className="flex flex-wrap items-center gap-1.5" data-slot={`${baseSlot}-chips`}>
        {chosen.length === 0 ? (
          <span className="text-xs text-text3" data-slot={`${baseSlot}-empty`}>
            {empty}
          </span>
        ) : (
          chosen.map((option) => (
            <span
              key={option.id}
              className="inline-flex items-center gap-1"
              data-slot={`${baseSlot}-chip`}
              data-record-id={option.id}
            >
              {option.href === undefined ? (
                <StatusChip tone="info" label={option.name} />
              ) : (
                <Link href={option.href} className="underline-offset-2 hover:underline">
                  <StatusChip tone="info" label={option.name} />
                </Link>
              )}
              {option.chip === undefined ? null : (
                <StatusChip tone={option.chip.tone} label={option.chip.label} />
              )}
              {demo ? null : (
                <button
                  type="button"
                  aria-label={`Unlink ${option.name}`}
                  onClick={() => {
                    toggle(option.id);
                  }}
                  className="rounded-input px-1 text-xs text-text3 hover:text-bad"
                  data-slot={`${baseSlot}-remove`}
                >
                  ×
                </button>
              )}
            </span>
          ))
        )}
        <DisabledWrite active={demo} hint={DEMO_WRITE_HINT}>
          <DropdownMenu
            onOpenChange={(open) => {
              if (!open) setQuery('');
            }}
          >
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={demo || pending}
                data-slot={`${baseSlot}-add`}
              >
                {pending ? 'Saving…' : `Link ${heading.toLowerCase()}`}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-80 w-72 overflow-y-auto">
              <DropdownMenuLabel>{heading}</DropdownMenuLabel>
              <div className="px-2 pb-1">
                <Input
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                  }}
                  onKeyDown={(event) => {
                    event.stopPropagation();
                  }}
                  placeholder="Search…"
                  aria-label={`Search ${heading.toLowerCase()}`}
                  className="h-8"
                  data-slot={`${baseSlot}-search`}
                />
              </div>
              <DropdownMenuSeparator />
              {offered.length === 0 ? (
                <p className="px-2 py-1.5 text-xs text-text3">No match.</p>
              ) : (
                offered.map((option) => (
                  <DropdownMenuCheckboxItem
                    key={option.id}
                    checked={ids.includes(option.id)}
                    data-slot={`${baseSlot}-option`}
                    data-record-id={option.id}
                    onCheckedChange={() => {
                      toggle(option.id);
                    }}
                    onSelect={(event) => {
                      event.preventDefault();
                    }}
                  >
                    {option.name}
                  </DropdownMenuCheckboxItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </DisabledWrite>
      </div>
      {inputName === undefined
        ? null
        : ids.map((id) => <input key={id} type="hidden" name={inputName} value={id} />)}
      {error === undefined ? null : <p className="text-xs text-bad">{error}</p>}
      {failure === null ? null : (
        <p className="text-xs text-bad" data-slot={`${baseSlot}-error`}>
          {failure}
        </p>
      )}
    </div>
  );
}
