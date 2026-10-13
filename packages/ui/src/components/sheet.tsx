'use client';

import * as React from 'react';
import * as SheetPrimitive from '@radix-ui/react-dialog';
import { cva, type VariantProps } from 'class-variance-authority';
import { XIcon } from 'lucide-react';

import { cn } from '../lib/cn';

/**
 * shadcn/ui Sheet (Oct 12 client sync, scope 2): a Dialog that slides in from an edge. The Brief
 * row sidebar is `side="right"`; the overlay dims the grid behind it, Escape and the close button
 * dismiss it, and focus is trapped inside while it is open — which is what makes it a Sheet and not
 * the fixed `<aside>` panels it replaces. Colours, radii and the mono face come from the token
 * layer through the semantic classes; no literal anywhere. The side sheets cast `shadow-sheet`
 * (B2.V2) — the long leftward `--bg-deep` cast the board draws onto the dimmed grid, which the
 * downward `shadow-lg` cannot express; the top and bottom edges keep `shadow-lg`.
 */
function Sheet({ ...props }: React.ComponentProps<typeof SheetPrimitive.Root>) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />;
}

function SheetTrigger({ ...props }: React.ComponentProps<typeof SheetPrimitive.Trigger>) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

function SheetClose({ ...props }: React.ComponentProps<typeof SheetPrimitive.Close>) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />;
}

function SheetPortal({ ...props }: React.ComponentProps<typeof SheetPrimitive.Portal>) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />;
}

function SheetOverlay({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Overlay>) {
  return (
    <SheetPrimitive.Overlay
      data-slot="sheet-overlay"
      className={cn('fixed inset-0 z-50 bg-bg-deep/60', className)}
      {...props}
    />
  );
}

const sheetVariants = cva('fixed z-50 flex flex-col gap-0 bg-surface text-text', {
  variants: {
    side: {
      right: 'inset-y-0 right-0 h-full w-full border-l border-line2 shadow-sheet sm:max-w-md',
      left: 'inset-y-0 left-0 h-full w-full border-r border-line2 shadow-sheet sm:max-w-md',
      top: 'inset-x-0 top-0 h-auto border-b border-line2 shadow-lg',
      bottom: 'inset-x-0 bottom-0 h-auto border-t border-line2 shadow-lg',
    },
  },
  defaultVariants: { side: 'right' },
});

function SheetContent({
  className,
  children,
  side = 'right',
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> &
  VariantProps<typeof sheetVariants> & { showCloseButton?: boolean }) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        data-side={side ?? 'right'}
        className={cn(sheetVariants({ side }), className)}
        {...props}
      >
        {children}
        {showCloseButton ? (
          <SheetPrimitive.Close
            data-slot="sheet-close"
            className="absolute top-4 right-4 rounded-input border border-line2 bg-surface2 p-1 text-text3 transition-colors hover:text-text focus-visible:ring-[3px] focus-visible:ring-accent-soft focus-visible:outline-none disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </SheetPrimitive.Close>
        ) : null}
      </SheetPrimitive.Content>
    </SheetPortal>
  );
}

function SheetHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sheet-header"
      className={cn('flex flex-col gap-1.5 border-b border-line p-4 pr-14', className)}
      {...props}
    />
  );
}

function SheetFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn('mt-auto flex gap-2 border-t border-line bg-surface p-4', className)}
      {...props}
    />
  );
}

function SheetTitle({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn('text-base leading-snug font-semibold text-text', className)}
      {...props}
    />
  );
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn('text-xs text-text3', className)}
      {...props}
    />
  );
}

export {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetOverlay,
  SheetPortal,
  SheetTitle,
  SheetTrigger,
  sheetVariants,
};
