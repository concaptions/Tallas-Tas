// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { CreatorProfileCard } from './creator-profile-card';
import { EM_DASH } from './fields';

/**
 * The profile pic card at the top of the creator panel (Ticket 14): what it reads from each stored
 * value, what it renders when a value is missing, and the two avatar states.
 */

describe('CreatorProfileCard', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the picture, the name, the mono @handle and the rating widget when every field is set', () => {
    const { getByText, container } = render(
      <CreatorProfileCard
        name="Danielle Okonkwo"
        profilePicUrl="https://example.com/d.jpg"
        instagramUsername="danielle.sleeps.late"
        rating={4}
      />,
    );

    const img = container.querySelector('img[data-slot="profile-card-avatar"]');
    expect(img).not.toBeNull();
    expect(img?.getAttribute('src')).toBe('https://example.com/d.jpg');
    expect(getByText('Danielle Okonkwo').getAttribute('data-slot')).toBe('profile-card-name');

    const handle = container.querySelector('[data-slot="profile-card-handle"]');
    expect(handle?.textContent).toBe('@danielle.sleeps.late');
    expect(handle?.className).toContain('font-mono');

    // The rating strip mounts and labels itself for a screen reader.
    const rating = container.querySelector(
      '[data-slot="profile-card-rating"] [aria-label*="performance rating"]',
    );
    expect(rating).not.toBeNull();
  });

  it('strips a leading @ already stored on the handle, so it never doubles up', () => {
    const { container } = render(
      <CreatorProfileCard
        name="Marcus"
        profilePicUrl={null}
        instagramUsername="@marcus.after.midnight"
        rating={null}
      />,
    );
    const handle = container.querySelector('[data-slot="profile-card-handle"]');
    expect(handle?.textContent).toBe('@marcus.after.midnight');
  });

  it('falls back to initials and shows the em dash when picture and handle are missing', () => {
    const { container } = render(
      <CreatorProfileCard
        name="Tomás Ferreira"
        profilePicUrl={null}
        instagramUsername={null}
        rating={null}
      />,
    );
    const avatar = container.querySelector('[data-slot="profile-card-avatar"]');
    expect(avatar?.getAttribute('data-fallback')).toBe('initials');
    expect(avatar?.textContent).toBe('TF');
    const handle = container.querySelector('[data-slot="profile-card-handle"]');
    expect(handle?.textContent).toBe(EM_DASH);
  });
});
