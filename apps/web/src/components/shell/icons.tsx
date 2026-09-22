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
  | 'queue-internal'
  | 'queue-client'
  | 'team'
  | 'interface'
  | 'notifications'
  | 'propagation'
  | 'sun'
  | 'moon'
  | 'chevron'
  | 'user'
  | 'building'
  | 'assets'
  | 'performance'
  | 'ad-spy'
  | 'creator-ranking'
  | 'upload-links'
  | 'collections'
  | 'creative-dimensions'
  | 'ai-characters'
  | 'competitive-research'
  | 'campaigns'
  | 'onboarding-forms';

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
  'queue-internal': 'M4 5.5h6v13H4zM14 5.5h6v8h-6zM4 5.5h6M14 17.5h6M14 20.5h6',
  'queue-client': 'M4 5.5h6v8H4zM14 5.5h6v13h-6zM4 17.5h6M4 20.5h6M9.2 9.2 6.8 11 5.6 9.9',
  team: 'M8 11a3.2 3.2 0 1 0 0-6.4A3.2 3.2 0 0 0 8 11zM2 20c0-3.1 2.7-5.1 6-5.1S14 16.9 14 20M16 5.2a3.1 3.1 0 0 1 0 6.1M22 19.4c0-2.4-1.7-4.1-4-4.6',
  interface: 'M3 5h18v14H3zM9 5v14M3 9.5h6M12 9h6M12 12.5h6M12 16h4',
  notifications:
    'M12 3a5.5 5.5 0 0 0-5.5 5.5c0 4.2-1.5 5.5-1.5 5.5h14s-1.5-1.3-1.5-5.5A5.5 5.5 0 0 0 12 3zM10.2 18a2 2 0 0 0 3.6 0',
  propagation:
    'M12 2.8v5.4M12 8.2 5.5 12.5M12 8.2l6.5 4.3M12 2.8a1.6 1.6 0 1 0 0-.1M5.5 12.5v3.2M18.5 12.5v3.2M5.5 18.5a1.6 1.6 0 1 0 0 .1M18.5 18.5a1.6 1.6 0 1 0 0 .1',
  sun: 'M12 8.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6zM12 2v2.2M12 19.8V22M4.2 4.2l1.6 1.6M18.2 18.2l1.6 1.6M2 12h2.2M19.8 12H22M4.2 19.8l1.6-1.6M18.2 5.8l1.6-1.6',
  moon: 'M20.5 14.8A8.6 8.6 0 0 1 9.2 3.5a8.8 8.8 0 1 0 11.3 11.3z',
  chevron: 'm6.5 9.5 5.5 5.5 5.5-5.5',
  user: 'M12 12.2a4.1 4.1 0 1 0 0-8.2 4.1 4.1 0 0 0 0 8.2zM4 20.5c0-3.8 3.6-6.3 8-6.3s8 2.5 8 6.3',
  building:
    'M4 21V5.5A2.5 2.5 0 0 1 6.5 3h7A2.5 2.5 0 0 1 16 5.5V21M16 10h2.5A1.5 1.5 0 0 1 20 11.5V21M2.5 21h19M8 7.5h4M8 11.5h4M8 15.5h4',
  assets: 'M4 4h16v16H4zM9 4v16M15 4v16M4 9h16M4 15h16',
  performance: 'M3 20h18M6 16V10M10 16V6M14 16V8M18 16V4',
  'ad-spy':
    'M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5a6.5 6.5 0 1 0-6.5 6.5c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19zM9.5 14A4.5 4.5 0 1 1 14 9.5 4.5 4.5 0 0 1 9.5 14z',
  'creator-ranking': 'M12 2l3 6 6 1-4.5 4L18 19l-6-3.5L6 19l1.5-6L3 9l6-1z',
  'upload-links':
    'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71',
  collections: 'M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-6l-2-2H5a2 2 0 0 0-2 2z',
  'creative-dimensions': 'M21 3H3v18h18zM9 3v18M3 9h18M3 15h18M15 3v18',
  'ai-characters': 'M12 2a4 4 0 0 0-4 4v2a4 4 0 0 0 8 0V6a4 4 0 0 0-4-4zM8.5 14h7l2 8h-11z',
  'competitive-research': 'M2 12h4l3-9 4 18 3-9h4',
  campaigns:
    'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM10 14l2 2 4-4',
  'onboarding-forms':
    'M9 11h6M9 15h4M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM9 7h6',
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
