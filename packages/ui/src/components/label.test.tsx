import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Label } from './label';

/**
 * The required/optional marker (action item 37). Three states, because the third is what every
 * existing caller gets: a Label told nothing says nothing, so adding the prop could not move a
 * single panel in the app.
 */
describe('Label · the requirement marker', () => {
  const marker = (): HTMLElement | null =>
    document.querySelector('[data-slot="label-requirement"]');

  it('says nothing at all when the form has made no claim', () => {
    render(<Label htmlFor="f">Batch</Label>);

    expect(screen.getByText('Batch')).toBeDefined();
    expect(marker()).toBeNull();
  });

  it('says the word rather than drawing an asterisk, so it needs no legend of its own', () => {
    const { unmount } = render(<Label required>Batch</Label>);
    expect(marker()?.textContent).toBe('Required');
    expect(document.body.textContent).not.toContain('*');
    unmount();

    render(<Label required={false}>Hook examples</Label>);
    expect(marker()?.textContent).toBe('Optional');
    expect(document.body.textContent).not.toContain('*');
  });

  it('is read out as part of the label, which is how a screen reader is told', () => {
    render(
      <>
        <Label htmlFor="theme" required>
          Theme
        </Label>
        <input id="theme" />
      </>,
    );

    // The marker is inside the `<label>`, so the control's accessible name carries it. Matched
    // loosely because the accessible-name algorithm joins element nodes with a space and
    // jsdom/testing-library concatenates `textContent` instead.
    expect(screen.getByLabelText(/^Theme\s*Required$/)).toBeDefined();
  });

  it('never sets aria-required on the <label>, which has no role that supports it', () => {
    render(<Label required>Batch</Label>);

    expect(document.querySelector('label')?.hasAttribute('aria-required')).toBe(false);
  });

  it('carries the state as a data attribute, so a spec can count the two kinds', () => {
    const { unmount } = render(<Label required>Batch</Label>);
    expect(marker()?.dataset.required).toBe('true');
    unmount();

    render(<Label required={false}>Hook examples</Label>);
    expect(marker()?.dataset.required).toBe('false');
  });

  it('takes both tones from the token layer, so the two states differ by tone and not by size', () => {
    const { unmount } = render(<Label required>Batch</Label>);
    expect(marker()?.className).toContain('text-accent');
    unmount();

    render(<Label required={false}>Hook examples</Label>);
    expect(marker()?.className).toContain('text-text4');
  });

  it('keeps the caller’s classes on the label itself, marker or no marker', () => {
    render(
      <Label required className="text-[11px] uppercase">
        Batch
      </Label>,
    );

    const label = document.querySelector('label');
    expect(label?.className).toContain('uppercase');
    expect(label?.className).toContain('text-text2');
  });
});
