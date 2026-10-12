import type { SVGProps } from 'react';

/**
 * The handful of glyphs the Oct 12 Creative Sheet surfaces draw (Focus Mode's bar, the context
 * menu, the selection bar): inline paths on `currentColor`, so every icon takes the tone of the
 * text beside it and nothing new is installed. Same arrangement as `components/shell/icons.tsx`.
 */
export type SheetIconName =
  | 'prev'
  | 'next'
  | 'check'
  | 'x'
  | 'lock'
  | 'copy'
  | 'trash'
  | 'link'
  | 'focus'
  | 'status'
  | 'warn'
  | 'play'
  | 'arrow';

const PATHS: Record<SheetIconName, string> = {
  prev: 'M15 6l-6 6 6 6',
  next: 'M9 6l6 6-6 6',
  check: 'M20 6 9 17l-5-5',
  x: 'M18 6 6 18M6 6l12 12',
  lock: 'M4 10.5h16v10H4zM8 10.5V7a4 4 0 0 1 8 0v3.5',
  copy: 'M9 9h12v12H9zM5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1',
  trash:
    'M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13',
  link: 'M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7',
  focus: 'M3 4h18v16H3zM8 9h8M8 13h5',
  status: 'M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5',
  warn: 'M12 8v5M12 17h.01M10.3 3.9 2.4 17.5A1.9 1.9 0 0 0 4 20.4h16a1.9 1.9 0 0 0 1.6-2.9L13.7 3.9a1.9 1.9 0 0 0-3.4 0Z',
  play: 'M8 5.2v13.6L19 12Z',
  arrow: 'M5 12h14M13 6l6 6-6 6',
};

interface SheetIconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  readonly name: SheetIconName;
  readonly size?: number;
}

export function SheetIcon({ name, size = 14, className, ...props }: SheetIconProps) {
  return (
    <svg
      aria-hidden
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
