import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { BoldTag } from './tag';

describe('BoldTag', () => {
  it('renders an inert outlined pill with its content', () => {
    render(<BoldTag>Hydration</BoldTag>);
    const tag = screen.getByText('Hydration');
    expect(tag.dataset['slot']).toBe('bold-tag');
    expect(tag.className).toContain('h-[26px]');
    expect(tag.className).toContain('border-line2');
  });

  it('places an optional leading icon before the label', () => {
    render(<BoldTag icon={<svg data-testid="tag-icon" />}>Skincare</BoldTag>);
    const tag = screen.getByText('Skincare');
    expect(tag.firstElementChild).toBe(screen.getByTestId('tag-icon'));
  });
});
