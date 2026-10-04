'use client';

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@tas/ui';

import type { FieldOption } from './fields-menu';

/** The value standing for "whatever this page covers a card with by default". */
const DEFAULT_VALUE = '__default__';

interface CoverMenuProps {
  /** The media columns this brand resolves and this table allows as a cover, in resolver order. */
  readonly fields: readonly FieldOption[];
  /** The chosen cover column, or null while the page's own default is in force. */
  readonly coverField: string | null;
  readonly onCoverChange: (key: string | null) => void;
}

/**
 * The Cover popover (action item 16, "customise the card"): which media column covers a gallery
 * card. One choice, because a card has one cover.
 *
 * Renders NOTHING when the table has no media column to choose between — Products, Personas,
 * Angles and Concepts declare no `galleryFields`, so offering them an empty picker would advertise
 * a setting that cannot be made. The first entry hands the page's own default cover back, so the
 * choice is always reversible without knowing what the default was.
 *
 * The choice persists into the viewer's active view through the caller, exactly as the Fields and
 * Freeze popovers do; this component only renders and reports.
 */
export function CoverMenu({ fields, coverField, onCoverChange }: CoverMenuProps) {
  if (fields.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm" data-slot="gallery-cover">
          Cover
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-80 overflow-y-auto">
        <DropdownMenuLabel>Card cover</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={coverField ?? DEFAULT_VALUE}
          onValueChange={(value) => {
            onCoverChange(value === DEFAULT_VALUE ? null : value);
          }}
        >
          <DropdownMenuRadioItem
            value={DEFAULT_VALUE}
            data-slot="gallery-cover-option"
            data-field={DEFAULT_VALUE}
            onSelect={(event) => {
              event.preventDefault();
            }}
          >
            Page default
          </DropdownMenuRadioItem>
          {fields.map((field) => (
            <DropdownMenuRadioItem
              key={field.key}
              value={field.key}
              data-slot="gallery-cover-option"
              data-field={field.key}
              onSelect={(event) => {
                event.preventDefault();
              }}
            >
              {field.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
