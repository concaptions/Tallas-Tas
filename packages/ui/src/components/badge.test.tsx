import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { Badge } from './badge';

/**
 * The generic badge's filled variants ink in `--on-accent` since Ticket 0 (the ink on a filled
 * accent is white in both palettes; `text-bg` was dark on purple in dark mode). A rendered
 * assertion, like the Button's, so the token stays on the pill and no literal ever lands in it.
 */
describe('Badge', () => {
  it('inks its filled variants in text-on-accent and holds no colour literal', () => {
    const html = renderToStaticMarkup(
      <>
        <Badge>Default</Badge>
        <Badge variant="destructive">Destructive</Badge>
        <Badge variant="secondary">Secondary</Badge>
        <Badge variant="outline">Outline</Badge>
      </>,
    );

    expect(html).toContain('text-on-accent');
    expect(html).not.toContain('text-bg');
    expect(html).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgb\(/);
  });
});
