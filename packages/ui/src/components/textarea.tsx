import * as React from 'react';

import { cn } from '../lib/cn';

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'field-sizing-content flex min-h-16 w-full rounded-input border border-line bg-surface2 px-3 py-2 text-base text-text shadow-xs transition-[color,box-shadow] outline-none md:text-sm',
        'placeholder:text-text4',
        'focus-visible:border-accent-line focus-visible:ring-[3px] focus-visible:ring-accent-soft',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'aria-invalid:border-bad aria-invalid:ring-bad/20',
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
