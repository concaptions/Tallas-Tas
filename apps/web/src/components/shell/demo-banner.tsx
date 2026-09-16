import { DEMO_MODE_NOTICE } from '@/lib/demo-mode';

/**
 * States plainly that the visitor is looking at fixtures. The info tone comes from the token layer
 * (`--info`); `color-mix` keeps the tint on the same token instead of introducing a second colour.
 */
export function DemoBanner() {
  return (
    <div
      role="status"
      data-slot="demo-banner"
      className="border-b border-line px-4 py-2 text-center text-xs sm:px-6"
      style={{
        color: 'var(--info)',
        backgroundColor: 'color-mix(in srgb, var(--info) 12%, transparent)',
        borderColor: 'color-mix(in srgb, var(--info) 30%, transparent)',
      }}
    >
      {DEMO_MODE_NOTICE}
    </div>
  );
}
