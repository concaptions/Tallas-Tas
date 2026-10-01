'use client';

import {
  Button,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
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
}

/**
 * The Fields popover (Sprint 7, VIEWS-01): one checkbox per field, shared by the Grid and the
 * Gallery so hiding a column and hiding a card line are the same action. What it toggles persists
 * into the viewer's active view through the caller; this component only renders and reports.
 */
export function FieldsMenu({ fields, isVisible, onToggle }: FieldsMenuProps) {
  return (
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
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
