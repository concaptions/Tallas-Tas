import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { isStarFilled, NOT_RATED_LABEL, RatingStars, ratingLabel, stepStar } from './rating-stars';

describe('ratingLabel', () => {
  it('reads the rating against the scale', () => {
    expect(ratingLabel(3)).toBe('3 of 5 stars');
    expect(ratingLabel(1, 10)).toBe('1 of 10 stars');
  });

  it('names the unrated state', () => {
    expect(ratingLabel(null)).toBe(NOT_RATED_LABEL);
  });
});

describe('isStarFilled', () => {
  it('paints every star up to and including the value', () => {
    expect([1, 2, 3, 4, 5].map((position) => isStarFilled(position, 3))).toEqual([
      true,
      true,
      true,
      false,
      false,
    ]);
  });

  it('paints nothing for a null value', () => {
    expect([1, 2, 3, 4, 5].some((position) => isStarFilled(position, null))).toBe(false);
  });
});

describe('stepStar', () => {
  it('steps within the scale and wraps at both ends', () => {
    expect(stepStar(2, 1, 5)).toBe(3);
    expect(stepStar(5, 1, 5)).toBe(1);
    expect(stepStar(1, -1, 5)).toBe(5);
  });

  it('enters the scale from either end when nothing is rated', () => {
    expect(stepStar(null, 1, 5)).toBe(1);
    expect(stepStar(null, -1, 5)).toBe(5);
  });
});

describe('RatingStars', () => {
  it('read-only renders a labelled image with no buttons', () => {
    render(<RatingStars value={4} readOnly label="Average" />);
    const row = screen.getByRole('img', { name: 'Average: 4 of 5 stars' });
    expect(row.dataset['rating']).toBe('4');
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('read-only and unrated carries the visually hidden text', () => {
    render(<RatingStars value={null} readOnly />);
    expect(screen.getByText(NOT_RATED_LABEL).className).toContain('sr-only');
  });

  it('editable is a radiogroup of five radios with the value checked', () => {
    render(<RatingStars value={2} onChange={() => undefined} />);
    expect(screen.getByRole('radiogroup', { name: 'Rating' })).toBeDefined();
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(5);
    expect(radios.map((radio) => radio.getAttribute('aria-checked'))).toEqual([
      'false',
      'true',
      'false',
      'false',
      'false',
    ]);
    for (const radio of radios) {
      expect(radio.className).toContain('rounded-input');
    }
  });

  it('selects on click and steps with the arrow keys', () => {
    const onChange = vi.fn();
    render(<RatingStars value={3} onChange={onChange} />);
    const radios = screen.getAllByRole('radio');

    fireEvent.click(radios[4] as HTMLElement);
    expect(onChange).toHaveBeenLastCalledWith(5);

    fireEvent.keyDown(radios[2] as HTMLElement, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenLastCalledWith(4);

    fireEvent.keyDown(radios[2] as HTMLElement, { key: 'ArrowLeft' });
    expect(onChange).toHaveBeenLastCalledWith(2);

    fireEvent.keyDown(radios[2] as HTMLElement, { key: 'End' });
    expect(onChange).toHaveBeenLastCalledWith(5);

    fireEvent.keyDown(radios[2] as HTMLElement, { key: 'Home' });
    expect(onChange).toHaveBeenLastCalledWith(1);
  });

  it('ignores every input when disabled', () => {
    const onChange = vi.fn();
    render(<RatingStars value={null} onChange={onChange} disabled />);
    const radios = screen.getAllByRole('radio');
    fireEvent.click(radios[0] as HTMLElement);
    fireEvent.keyDown(radios[0] as HTMLElement, { key: 'ArrowRight' });
    expect(onChange).not.toHaveBeenCalled();
  });
});
