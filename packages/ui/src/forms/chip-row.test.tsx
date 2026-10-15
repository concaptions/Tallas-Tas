import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ChipRow, type ChipOption } from './chip-row';

const OPTIONS: ChipOption[] = [
  { value: 'tts', label: 'Text-to-speech' },
  { value: 'human', label: 'Human' },
  { value: 'none', label: 'None' },
];

describe('ChipRow', () => {
  describe('single mode', () => {
    it('renders a radiogroup with one radio per option', () => {
      render(
        <ChipRow
          mode="single"
          value={[]}
          options={OPTIONS}
          onChange={() => {}}
          ariaLabel="Voiceover"
        />,
      );
      const group = screen.getByRole('radiogroup', { name: 'Voiceover' });
      const chips = within(group).getAllByRole('radio');
      expect(chips).toHaveLength(3);
      for (const chip of chips) {
        expect(chip.getAttribute('aria-checked')).toBe('false');
      }
    });

    it('writes the new key when a chip is clicked', () => {
      const onChange = vi.fn();
      render(<ChipRow mode="single" value={['human']} options={OPTIONS} onChange={onChange} />);
      fireEvent.click(screen.getByRole('radio', { name: 'Text-to-speech' }));
      expect(onChange).toHaveBeenCalledWith(['tts']);
    });

    it('clears the selection when the already-selected chip is clicked (toggle off)', () => {
      const onChange = vi.fn();
      render(<ChipRow mode="single" value={['human']} options={OPTIONS} onChange={onChange} />);
      fireEvent.click(screen.getByRole('radio', { name: 'Human' }));
      expect(onChange).toHaveBeenCalledWith([]);
    });

    it('places Tab on the selected chip, or on the first chip when none is selected', () => {
      const { rerender } = render(
        <ChipRow mode="single" value={[]} options={OPTIONS} onChange={() => {}} />,
      );
      const first = screen.getAllByRole('radio');
      expect(first[0]?.getAttribute('tabIndex')).toBe('0');
      expect(first[1]?.getAttribute('tabIndex')).toBe('-1');

      rerender(<ChipRow mode="single" value={['none']} options={OPTIONS} onChange={() => {}} />);
      const after = screen.getAllByRole('radio');
      expect(after[0]?.getAttribute('tabIndex')).toBe('-1');
      expect(after[2]?.getAttribute('tabIndex')).toBe('0');
    });
  });

  describe('multi mode', () => {
    it('renders a group with one checkbox per option, Tab on each', () => {
      render(<ChipRow mode="multi" value={['tts']} options={OPTIONS} onChange={() => {}} />);
      const chips = screen.getAllByRole('checkbox');
      expect(chips).toHaveLength(3);
      expect(chips[0]?.getAttribute('aria-checked')).toBe('true');
      expect(chips[1]?.getAttribute('aria-checked')).toBe('false');
      for (const chip of chips) {
        expect(chip.getAttribute('tabIndex')).toBe('0');
      }
    });

    it('toggles the chip and keeps ordering in options order', () => {
      const onChange = vi.fn();
      render(<ChipRow mode="multi" value={['none']} options={OPTIONS} onChange={onChange} />);
      fireEvent.click(screen.getByRole('checkbox', { name: 'Text-to-speech' }));
      expect(onChange).toHaveBeenCalledWith(['tts', 'none']);
    });

    it('removes a toggled-off chip', () => {
      const onChange = vi.fn();
      render(
        <ChipRow mode="multi" value={['tts', 'human']} options={OPTIONS} onChange={onChange} />,
      );
      fireEvent.click(screen.getByRole('checkbox', { name: 'Text-to-speech' }));
      expect(onChange).toHaveBeenCalledWith(['human']);
    });
  });

  describe('disabled state', () => {
    it('does not fire onChange when the whole row is disabled', () => {
      const onChange = vi.fn();
      render(<ChipRow mode="single" value={[]} options={OPTIONS} onChange={onChange} disabled />);
      const chip = screen.getByRole('radio', { name: 'Human' });
      expect((chip as HTMLButtonElement).disabled).toBe(true);
      fireEvent.click(chip);
      expect(onChange).not.toHaveBeenCalled();
    });

    it('does not fire onChange when a single option is disabled', () => {
      const onChange = vi.fn();
      const options: ChipOption[] = [
        { value: 'tts', label: 'Text-to-speech' },
        { value: 'human', label: 'Human', disabled: true },
      ];
      render(<ChipRow mode="single" value={[]} options={options} onChange={onChange} />);
      fireEvent.click(screen.getByRole('radio', { name: 'Human' }));
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('keyboard navigation', () => {
    it('moves focus with Arrow keys and wraps at the ends', () => {
      render(<ChipRow mode="multi" value={[]} options={OPTIONS} onChange={() => {}} />);
      const [first, mid, last] = screen.getAllByRole('checkbox');
      if (first === undefined || mid === undefined || last === undefined) {
        throw new Error('ChipRow did not render three chips');
      }
      first.focus();
      fireEvent.keyDown(first, { key: 'ArrowRight' });
      expect(document.activeElement).toBe(mid);
      fireEvent.keyDown(mid, { key: 'ArrowDown' });
      expect(document.activeElement).toBe(last);
      fireEvent.keyDown(last, { key: 'ArrowRight' });
      // wraps to first
      expect(document.activeElement).toBe(first);
      fireEvent.keyDown(first, { key: 'ArrowLeft' });
      // wraps to last
      expect(document.activeElement).toBe(last);
      fireEvent.keyDown(last, { key: 'Home' });
      expect(document.activeElement).toBe(first);
      fireEvent.keyDown(first, { key: 'End' });
      expect(document.activeElement).toBe(last);
    });

    it('toggles with Enter and Space', () => {
      const onChange = vi.fn();
      render(<ChipRow mode="single" value={[]} options={OPTIONS} onChange={onChange} />);
      const chip = screen.getByRole('radio', { name: 'Human' });
      chip.focus();
      fireEvent.keyDown(chip, { key: 'Enter' });
      expect(onChange).toHaveBeenLastCalledWith(['human']);
      fireEvent.keyDown(chip, { key: ' ' });
      expect(onChange).toHaveBeenCalledTimes(2);
    });
  });

  it('exposes value, selected and group role on data-slot attributes', () => {
    render(<ChipRow mode="single" value={['none']} options={OPTIONS} onChange={() => {}} />);
    const chip = screen.getByRole('radio', { name: 'None' });
    expect(chip.getAttribute('data-slot')).toBe('chip-row-item');
    expect(chip.getAttribute('data-value')).toBe('none');
    expect(chip.getAttribute('data-selected')).toBe('true');
  });
});
