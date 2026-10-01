'use client';

import { useState } from 'react';
import type { UserView } from '@tas/domain';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  Label,
} from '@tas/ui';

/** The radio value standing for "no saved view": the table's own default lens. */
const DEFAULT_VALUE = '__default__';

interface ViewsMenuProps {
  readonly views: readonly UserView[];
  readonly activeViewId: string | null;
  readonly onActivate: (id: string | null) => void;
  readonly onCreate: (name: string) => void;
  readonly onRename: (id: string, name: string) => void;
  readonly onDelete: (id: string) => void;
  /** The validation error the last create or rename came back with, shown in the dialog. */
  readonly error?: string | null;
}

type DialogMode =
  | { readonly kind: 'closed' }
  | { readonly kind: 'create' }
  | {
      readonly kind: 'rename';
      readonly id: string;
      readonly current: string;
    };

/**
 * The Views menu (Sprint 7, VIEWS-01): the viewer's own saved views of this table, one active at
 * a time, plus "New view", "Rename" and "Delete" for the active one. Views are personal — nothing
 * here is shared with another user — so the menu never lists anyone else's. The name is taken in a
 * small dialog rather than `window.prompt`, so the same control works in a test and on a phone.
 */
export function ViewsMenu({
  views,
  activeViewId,
  onActivate,
  onCreate,
  onRename,
  onDelete,
  error = null,
}: ViewsMenuProps) {
  const [dialog, setDialog] = useState<DialogMode>({ kind: 'closed' });
  const [name, setName] = useState('');
  const active = views.find((view) => view.id === activeViewId) ?? null;

  const submit = () => {
    if (dialog.kind === 'create') onCreate(name);
    if (dialog.kind === 'rename') onRename(dialog.id, name);
    setDialog({ kind: 'closed' });
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" size="sm" data-slot="views-menu">
            {active === null ? 'Views' : active.name}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-52">
          <DropdownMenuLabel>My views</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup
            value={activeViewId ?? DEFAULT_VALUE}
            onValueChange={(value) => {
              onActivate(value === DEFAULT_VALUE ? null : value);
            }}
          >
            <DropdownMenuRadioItem
              value={DEFAULT_VALUE}
              data-slot="view-option"
              data-view="default"
            >
              Default
            </DropdownMenuRadioItem>
            {views.map((view) => (
              <DropdownMenuRadioItem
                key={view.id}
                value={view.id}
                data-slot="view-option"
                data-view={view.id}
              >
                {view.name}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            data-slot="view-new"
            onSelect={() => {
              setName('');
              setDialog({ kind: 'create' });
            }}
          >
            New view…
          </DropdownMenuItem>
          {active === null ? null : (
            <>
              <DropdownMenuItem
                data-slot="view-rename"
                onSelect={() => {
                  setName(active.name);
                  setDialog({ kind: 'rename', id: active.id, current: active.name });
                }}
              >
                Rename “{active.name}”
              </DropdownMenuItem>
              <DropdownMenuItem
                data-slot="view-delete"
                variant="destructive"
                onSelect={() => {
                  onDelete(active.id);
                }}
              >
                Delete “{active.name}”
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog
        open={dialog.kind !== 'closed'}
        onOpenChange={(open) => {
          if (!open) setDialog({ kind: 'closed' });
        }}
      >
        <DialogContent data-slot="view-name-dialog">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
            className="flex flex-col gap-4"
          >
            <DialogHeader>
              <DialogTitle>{dialog.kind === 'rename' ? 'Rename view' : 'New view'}</DialogTitle>
              <DialogDescription>
                A view is yours alone: the fields, order, sort and search you choose here are
                remembered for you and never change what anyone else sees.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="view-name">Name</Label>
              <Input
                id="view-name"
                name="name"
                value={name}
                autoFocus
                onChange={(event) => {
                  setName(event.target.value);
                }}
                placeholder="e.g. My queue"
                data-slot="view-name-input"
              />
              {error === null ? null : <p className="text-xs text-bad">{error}</p>}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setDialog({ kind: 'closed' });
                }}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" data-slot="view-name-save">
                {dialog.kind === 'rename' ? 'Rename' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
