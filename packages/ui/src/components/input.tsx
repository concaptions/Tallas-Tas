import * as React from 'react';

import { cn } from '../lib/cn';

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'flex h-9 w-full min-w-0 rounded-input border border-line bg-surface2 px-3 py-1 text-base text-text shadow-xs transition-[color,box-shadow] outline-none md:text-sm',
        'file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-text',
        'placeholder:text-text4 selection:bg-accent selection:text-bg',
        'focus-visible:border-accent-line focus-visible:ring-[3px] focus-visible:ring-accent-soft',
        'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
        'aria-invalid:border-bad aria-invalid:ring-bad/20',
        className,
      )}
      {...props}
    />
  );
}

export { Input };
