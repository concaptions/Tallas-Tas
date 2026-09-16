import type { SVGProps } from 'react';

/**
 * The shell's icon set, drawn inline. `currentColor` everywhere, so an icon follows the token class
 * of whatever it sits in and never carries a colour of its own.
 */
export type IconName =
  | 'overview'
  | 'products'
  | 'personas'
  | 'angles'
  | 'themes'
  | 'concepts'
  | 'briefs'
  | 'copywriting'
  | 'ugc'
  | 'client'
  | 'design-system'
  | 'admin'
  | 'sun'
  | 'moon'
  | 'chevron'
  | 'user'
  | 'building';

const PATHS: Record<IconName, string> = {
  overview: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  products: 'M12 2.5 20.5 7v10L12 21.5 3.5 17V7zM3.5 7 12 11.5 20.5 7M12 11.5v10',
  personas:
    'M9 11.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20c0-3.3 2.9-5.5 6.5-5.5s6.5 2.2 6.5 5.5M16.5 5.2a3.3 3.3 0 0 1 0 6.4M21.5 19.5c0-2.6-1.8-4.4-4.2-5',
  angles: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8.5 15.5l2.8-4.2 4.2-2.8-2.8 4.2z',
  themes: 'M12 2.5 3 7l9 4.5L21 7zM3 12l9 4.5L21 12M3 17l9 4.5L21 17',
  concepts:
    'M9.5 18.5h5M10.5 21.5h3M12 2.5a6 6 0 0 0-3.6 10.8c.6.5 1.1 1.3 1.1 2.2h5c0-.9.5-1.7 1.1-2.2A6 6 0 0 0 12 2.5z',
  briefs:
    'M14 2.5H7A2 2 0 0 0 5 4.5v15a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-11zM14 2.5v6h5M9 13h6M9 17h4',
  copywriting: 'M4 20h4L19.2 8.8a2.55 2.55 0 1 0-3.6-3.6L4 16.4zM14.5 6.5l3.6 3.6M4 20l.6-3.6',
  ugc: 'M3.5 7.5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2zM14.5 10.5l6-3v9l-6-3z',
  client: 'M3 5h18v11H3zM8.5 20.5h7M12 16v4.5M7 9.5h6M7 12.5h4',
  'design-system':
    'M12 3a9 9 0 1 0 0 18 2.6 2.6 0 0 0 0-5.2 2.6 2.6 0 0 1 0-5.2h1.4A4.6 4.6 0 0 0 18 6.4 5.6 5.6 0 0 0 12 3zM7.8 8.4h.01M6.9 12.6h.01M9.6 16.2h.01',
  admin: 'M12 2.5 20 5.5v6.2c0 4.5-3.4 8.1-8 9.8-4.6-1.7-8-5.3-8-9.8V5.5zM9 11.8l2.2 2.2L15.5 9.7',
  sun: 'M12 8.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6zM12 2v2.2M12 19.8V22M4.2 4.2l1.6 1.6M18.2 18.2l1.6 1.6M2 12h2.2M19.8 12H22M4.2 19.8l1.6-1.6M18.2 5.8l1.6-1.6',
  moon: 'M20.5 14.8A8.6 8.6 0 0 1 9.2 3.5a8.8 8.8 0 1 0 11.3 11.3z',
  chevron: 'm6.5 9.5 5.5 5.5 5.5-5.5',
  user: 'M12 12.2a4.1 4.1 0 1 0 0-8.2 4.1 4.1 0 0 0 0 8.2zM4 20.5c0-3.8 3.6-6.3 8-6.3s8 2.5 8 6.3',
  building:
    'M4 21V5.5A2.5 2.5 0 0 1 6.5 3h7A2.5 2.5 0 0 1 16 5.5V21M16 10h2.5A1.5 1.5 0 0 1 20 11.5V21M2.5 21h19M8 7.5h4M8 11.5h4M8 15.5h4',
};

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName;
}

export function Icon({ name, className, ...props }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
