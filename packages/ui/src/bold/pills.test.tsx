import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { BoldPills, BoldSeg } from './pills';

const PILLS = [
  { key: 'all', label: 'All', count: 24 },
  { key: 'winning', label: 'Winning', count: 3 },
] as const;

describe('BoldPills', () => {
  it('renders a labelled group of toggle buttons with aria-pressed on the active filter', () => {
    render(
      <BoldPills items={PILLS} value="winning" onChange={() => undefined} label="Filter angles" />,
    );
    expect(screen.getByRole('group', { name: 'Filter angles' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'All24', pressed: false })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Winning3', pressed: true })).toBeDefined();
  });

  it('reports the clicked key', () => {
    const onChange = vi.fn();
    render(<BoldPills items={PILLS} value="all" onChange={onChange} label="Filter angles" />);
    fireEvent.click(screen.getByRole('button', { name: 'Winning3' }));
    expect(onChange).toHaveBeenCalledWith('winning');
  });
});

describe('BoldSeg', () => {
  const SEG = [
    { key: 'grid', label: 'Grid' },
    { key: 'gallery', label: 'Gallery' },
  ] as const;

  it('is an inset aria-pressed switcher', () => {
    const onChange = vi.fn();
    render(<BoldSeg items={SEG} value="grid" onChange={onChange} label="Sheet layout" />);
    expect(screen.getByRole('group', { name: 'Sheet layout' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Grid', pressed: true })).toBeDefined();
    const gallery = screen.getByRole('button', { name: 'Gallery', pressed: false });
    fireEvent.click(gallery);
    expect(onChange).toHaveBeenCalledWith('gallery');
  });
});
