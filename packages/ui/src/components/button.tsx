import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../lib/cn';

// shadcn/ui new-york Button, moved out of apps/web. Colours come from the token utilities; the
// radius is `rounded-input` (6px) because the design system has no pill buttons.
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-input text-sm font-medium whitespace-nowrap transition-all outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-bad aria-invalid:ring-bad/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: 'bg-accent text-bg shadow-xs hover:bg-accent/90',
        destructive: 'bg-bad text-bg shadow-xs hover:bg-bad/90 focus-visible:ring-bad/20',
        outline: 'border border-line bg-surface text-text shadow-xs hover:bg-surface3',
        secondary: 'bg-surface3 text-text shadow-xs hover:bg-surface4',
        ghost: 'text-text2 hover:bg-surface3 hover:text-text',
        link: 'text-accent underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2 has-[>svg]:px-3',
        sm: 'h-8 gap-1.5 rounded-input px-3 has-[>svg]:px-2.5',
        lg: 'h-10 rounded-input px-6 has-[>svg]:px-4',
        icon: 'size-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : 'button';

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
