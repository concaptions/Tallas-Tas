import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { BoldBanner } from './banner';
import { BoldEmptyState } from './empty-state';

describe('BoldBanner', () => {
  it('renders content, the icon tile and the trailing action', () => {
    render(
      <BoldBanner
        icon={<svg data-testid="banner-icon" />}
        action={<button type="button">Got it</button>}
      >
        Themes are a global library across all brands.
      </BoldBanner>,
    );
    const banner = screen.getByText('Themes are a global library across all brands.').parentElement;
    expect(banner?.getAttribute('data-slot')).toBe('bold-banner');
    expect(screen.getByTestId('banner-icon')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Got it' })).toBeDefined();
  });

  it('paints only through tokens: the gradient is var()-based', () => {
    render(<BoldBanner>note</BoldBanner>);
    const banner = screen.getByText('note').parentElement as HTMLElement;
    expect(banner.style.background).toContain('var(--side-bg)');
    expect(banner.style.background).toContain('var(--accent)');
  });
});

describe('BoldEmptyState', () => {
  it('renders the heading, the line and the optional action', () => {
    render(
      <BoldEmptyState
        title="No concepts yet"
        description="Create the first concept from an approved angle."
        action={<button type="button">New concept</button>}
      />,
    );
    expect(screen.getByRole('heading', { name: 'No concepts yet' })).toBeDefined();
    expect(screen.getByText('Create the first concept from an approved angle.')).toBeDefined();
    expect(screen.getByRole('button', { name: 'New concept' })).toBeDefined();
  });

  it('omits what it is not given', () => {
    render(<BoldEmptyState title="Nothing here" />);
    expect(screen.getByRole('heading', { name: 'Nothing here' })).toBeDefined();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
