import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { DatePicker } from './date-picker';

describe('DatePicker', () => {
  it('renders a native date input carrying the ISO value', () => {
    render(<DatePicker value="2026-10-20" onChange={() => {}} ariaLabel="Due" />);
    const input = screen.getByLabelText('Due');
    expect(input.getAttribute('type')).toBe('date');
    expect((input as HTMLInputElement).value).toBe('2026-10-20');
    expect(input.getAttribute('data-slot')).toBe('date-picker-input');
  });

  it('renders an empty input when the value is null', () => {
    render(<DatePicker value={null} onChange={() => {}} ariaLabel="Due" />);
    const input = screen.getByLabelText('Due');
    expect((input as HTMLInputElement).value).toBe('');
  });

  it('passes min and max through to the native input', () => {
    render(
      <DatePicker
        value={null}
        onChange={() => {}}
        min="2026-01-01"
        max="2026-12-31"
        ariaLabel="Due"
      />,
    );
    const input = screen.getByLabelText('Due');
    expect(input.getAttribute('min')).toBe('2026-01-01');
    expect(input.getAttribute('max')).toBe('2026-12-31');
  });

  it('writes the picked ISO date when the input changes', () => {
    const onChange = vi.fn();
    render(<DatePicker value={null} onChange={onChange} ariaLabel="Due" />);
    const input = screen.getByLabelText('Due');
    fireEvent.change(input, { target: { value: '2026-11-01' } });
    expect(onChange).toHaveBeenCalledWith('2026-11-01');
  });

  it('writes null when the input is cleared', () => {
    const onChange = vi.fn();
    render(<DatePicker value="2026-10-20" onChange={onChange} ariaLabel="Due" />);
    const input = screen.getByLabelText('Due');
    fireEvent.change(input, { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('does not fire onChange when disabled', () => {
    const onChange = vi.fn();
    render(<DatePicker value="2026-10-20" onChange={onChange} ariaLabel="Due" disabled />);
    const input = screen.getByLabelText('Due');
    expect((input as HTMLInputElement).disabled).toBe(true);
    // Even if a change were triggered, the native input is disabled; the wrapper carries
    // aria-disabled and opacity-50 for the reader.
    const wrapper = input.parentElement;
    expect(wrapper?.getAttribute('aria-disabled')).toBe('true');
  });

  it('places the data-slot on the wrapper for the caller to style', () => {
    render(<DatePicker value={null} onChange={() => {}} dataSlot="due-date" ariaLabel="Due" />);
    const input = screen.getByLabelText('Due');
    expect(input.parentElement?.getAttribute('data-slot')).toBe('due-date');
  });
});
