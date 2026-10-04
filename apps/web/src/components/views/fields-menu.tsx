'use client';

import { useState } from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@tas/ui';

export interface FieldOption {
  readonly key: string;
  readonly label: string;
}

interface FieldsMenuProps {
  readonly fields: readonly FieldOption[];
  readonly isVisible: (key: string) => boolean;
  readonly onToggle: (key: string) => void;
  /**
   * Moves one field a step up or down in the viewer's order (action item 16, "customise the
   * card"). Given, the popover grows an "Arrange fields…" entry that opens the arrange dialog;
   * absent — the uncontrolled grids that keep their own hidden set — the popover stays toggles
   * only, because there is no view to remember an order in.
   */
  readonly onMoveField?: (key: string, direction: 'up' | 'down') => void;
}

/**
 * The Fields popover (Sprint 7, VIEWS-01): one checkbox per field, shared by the Grid and the
 * Gallery so hiding a column and hiding a card line are the same action. What it toggles persists
 * into the viewer's active view through the caller; this component only renders and reports.
 *
 * REORDER lives behind "Arrange fields…" in a dialog rather than as buttons inside the menu items
 * (action item 16): a Radix menu owns Tab and the arrow keys for its own roving focus, so a button
 * nested in a menu item is mouse-only — exactly what the Views menu's name dialog exists to avoid.
 * In the dialog every Move button is an ordinary tab stop, Enter and Space activate it, and each
 * press reports through `onMoveField`; the caller persists it into the same view the checkboxes
 * write, and the rows re-sort live because `fields` arrives already in the viewer's order.
 */
export function FieldsMenu({ fields, isVisible, onToggle, onMoveField }: FieldsMenuProps) {
  const [arranging, setArranging] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" size="sm" data-slot="grid-fields">
            Fields
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="max-h-80 overflow-y-auto">
          <DropdownMenuLabel>Show fields</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {fields.map((field) => (
            <DropdownMenuCheckboxItem
              key={field.key}
              checked={isVisible(field.key)}
              data-slot="grid-field-toggle"
              data-field={field.key}
              onCheckedChange={() => {
                onToggle(field.key);
              }}
              onSelect={(event) => {
                event.preventDefault();
              }}
            >
              {field.label}
            </DropdownMenuCheckboxItem>
          ))}
          {onMoveField === undefined ? null : (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                data-slot="fields-arrange"
                onSelect={() => {
                  setArranging(true);
                }}
              >
                Arrange fields…
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {onMoveField === undefined ? null : (
        <Dialog open={arranging} onOpenChange={setArranging}>
          <DialogContent data-slot="fields-arrange-dialog" className="max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Arrange fields</DialogTitle>
              <DialogDescription>
                The order here is the order of your grid columns and your gallery card lines. It is
                part of your view — nobody else&rsquo;s table moves.
              </DialogDescription>
            </DialogHeader>
            <ol className="flex flex-col">
              {fields.map((field, index) => (
                <li
                  key={field.key}
                  data-slot="fields-arrange-row"
                  data-field={field.key}
                  className="flex items-center justify-between gap-3 border-b border-line/60 py-1.5 last:border-b-0"
                >
                  <span className="min-w-0 truncate text-sm text-text2">{field.label}</span>
                  <span className="flex shrink-0 items-center gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 w-7 px-0"
                      disabled={index === 0}
                      aria-label={`Move ${field.label} up`}
                      data-slot="field-move-up"
                      data-field={field.key}
                      onClick={() => {
                        onMoveField(field.key, 'up');
                      }}
                    >
                      ↑
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 w-7 px-0"
                      disabled={index === fields.length - 1}
                      aria-label={`Move ${field.label} down`}
                      data-slot="field-move-down"
                      data-field={field.key}
                      onClick={() => {
                        onMoveField(field.key, 'down');
                      }}
                    >
                      ↓
                    </Button>
                  </span>
                </li>
              ))}
            </ol>
            <DialogFooter>
              <Button
                type="button"
                size="sm"
                data-slot="fields-arrange-done"
                onClick={() => {
                  setArranging(false);
                }}
              >
                Done
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
