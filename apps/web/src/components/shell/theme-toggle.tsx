'use client';

import { useEffect, useState } from 'react';
import { Button } from '@tas/ui';

import { DEFAULT_THEME, THEME_STORAGE_KEY, isTheme, type Theme } from '@/lib/theme';

/** Reads the remembered theme. Every `localStorage` access is wrapped: it throws in a private window. */
function storedTheme(): Theme | null {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(value) ? value : null;
  } catch {
    return null;
  }
}

function remember(theme: Theme): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // A private window or blocked site data: the theme still applies for this page view.
  }
}

/**
 * Flips `data-theme` on `<html>`, which is the only switch the token layer reads, and remembers the
 * choice. The first paint is not this component's job: `THEME_BOOT_SCRIPT` in the root layout has
 * already applied the stored value in `<head>`, so there is no flash and nothing to hydrate around.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(DEFAULT_THEME);

  useEffect(() => {
    const attribute = document.documentElement.getAttribute('data-theme');
    setTheme(isTheme(attribute) ? attribute : (storedTheme() ?? DEFAULT_THEME));
  }, []);

  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    remember(next);
    setTheme(next);
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
      data-theme-state={theme}
      className="text-text2 hover:text-text"
    >
      {/* The glyph shows the current theme; the label says what clicking does. */}
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-4"
      >
        {theme === 'dark' ? (
          <path d="M12 8.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6zM12 2v2.2M12 19.8V22M4.2 4.2l1.6 1.6M18.2 18.2l1.6 1.6M2 12h2.2M19.8 12H22M4.2 19.8l1.6-1.6M18.2 5.8l1.6-1.6" />
        ) : (
          <path d="M20.5 14.8A8.6 8.6 0 0 1 9.2 3.5a8.8 8.8 0 1 0 11.3 11.3z" />
        )}
      </svg>
    </Button>
  );
}
