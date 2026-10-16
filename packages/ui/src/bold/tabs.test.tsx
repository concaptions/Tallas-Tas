import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { BoldSubnav, BoldTabs } from './tabs';

const ITEMS = [
  { key: 'pipeline', label: 'Pipeline', count: 8 },
  { key: 'pool', label: 'Creator pool', count: 12 },
  { key: 'ads', label: 'Partnership ads' },
] as const;

describe('BoldTabs', () => {
  it('renders a labelled tablist with aria-selected on the active tab and its count badge', () => {
    render(<BoldTabs items={ITEMS} value="pool" onChange={() => undefined} label="UGC views" />);
    const tablist = screen.getByRole('tablist', { name: 'UGC views' });
    const tabs = screen.getAllByRole('tab');
    expect(tablist).toBeDefined();
    expect(tabs).toHaveLength(3);
    expect(screen.getByRole('tab', { name: 'Creator pool12', selected: true })).toBeDefined();
    expect(screen.getByRole('tab', { name: 'Pipeline8', selected: false })).toBeDefined();
  });

  it('roves focus only: the selected tab is the single tab stop', () => {
    render(<BoldTabs items={ITEMS} value="pool" onChange={() => undefined} label="UGC views" />);
    const [pipeline, pool, ads] = screen.getAllByRole('tab');
    expect(pipeline?.tabIndex).toBe(-1);
    expect(pool?.tabIndex).toBe(0);
    expect(ads?.tabIndex).toBe(-1);
  });

  it('moves focus with ArrowRight/ArrowLeft (wrapping) and Home/End, selecting on click only', () => {
    const onChange = vi.fn();
    render(<BoldTabs items={ITEMS} value="pipeline" onChange={onChange} label="UGC views" />);
    const tabs = screen.getAllByRole('tab');
    tabs[0]?.focus();
    fireEvent.keyDown(tabs[0] as HTMLElement, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(tabs[1]);
    fireEvent.keyDown(tabs[1] as HTMLElement, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(tabs[0]);
    fireEvent.keyDown(tabs[0] as HTMLElement, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(tabs[2]);
    fireEvent.keyDown(tabs[2] as HTMLElement, { key: 'Home' });
    expect(document.activeElement).toBe(tabs[0]);
    fireEvent.keyDown(tabs[0] as HTMLElement, { key: 'End' });
    expect(document.activeElement).toBe(tabs[2]);
    // Manual activation: arrows never selected anything.
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(tabs[2] as HTMLElement);
    expect(onChange).toHaveBeenCalledWith('ads');
  });
});

describe('BoldSubnav', () => {
  it('is the same tablist contract under the underline paint', () => {
    const onChange = vi.fn();
    render(<BoldSubnav items={ITEMS} value="ads" onChange={onChange} label="Settings sections" />);
    expect(screen.getByRole('tablist', { name: 'Settings sections' })).toBeDefined();
    const selected = screen.getByRole('tab', { name: 'Partnership ads', selected: true });
    expect(selected.tabIndex).toBe(0);
    const tabs = screen.getAllByRole('tab');
    fireEvent.keyDown(selected, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(tabs[0]);
    fireEvent.click(tabs[0] as HTMLElement);
    expect(onChange).toHaveBeenCalledWith('pipeline');
  });
});
